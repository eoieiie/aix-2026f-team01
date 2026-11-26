-- 0023 직접 적은 메뉴의 재료를 AI가 추정 (명세 4-22, 2026-11-21)
-- 흐름: 앱이 Edge Function guess-ingredients에 음식 id만 보낸다 → 함수가 부른 사람의 JWT로 ai_ingredient_request를 부른다
--   (직접 적은 메뉴인지, 부른 사람이 그 메뉴가 후보인 판의 참여자인지, 저장한 값이 있는지, 하루 상한을 넘었는지 서버가 본다)
--   → 저장한 값이 없으면 함수가 Gemini에 메뉴 이름만 보내고 → service role로 ai_ingredient_apply를 불러 저장, 판정
-- 원칙: 재료 태그 9개 밖 값은 버린다. 더하기만 한다(tags에 합집합, 빼지 않는다). 실패하면 낱말 표 태그만 남는다

create or replace function public.app_limits() returns jsonb
language sql immutable set search_path = ''
as $$
  select '{"GROUP_NAME_MAX": 40, "DISPLAY_NAME_MAX": 20, "INVITE_CODE_LENGTH": 6, "PITCH_MAX": 60, "MAX_VOTES_PER_PERSON": 2, "HANDLE_MIN": 3, "HANDLE_MAX": 16, "QUIZ_LENGTH": 8, "FOOD_NAME_MAX": 20, "AI_DAILY_MAX": 200}'::jsonb
$$;

alter table public.foods add column if not exists ai_tags text[] not null default '{}';
alter table public.foods add column if not exists ai_notes jsonb;
alter table public.foods add column if not exists ai_status text;
alter table public.foods drop constraint if exists foods_ai_status_check;
alter table public.foods add constraint foods_ai_status_check check (ai_status is null or ai_status in ('pending', 'done', 'failed'));

-- 같은 이름은 한 번만 묻는다. 이름 키는 공백을 빼고 소문자로
create table if not exists public.ai_ingredient_cache (
  name_key text primary key,
  tags text[] not null default '{}',
  notes jsonb,
  model text,
  created_at timestamptz not null default now()
);
alter table public.ai_ingredient_cache enable row level security;

-- 하루 호출 수 (한국 날짜)
create table if not exists public.ai_usage (
  day date primary key,
  calls int not null default 0
);
alter table public.ai_usage enable row level security;

create or replace function public.ai_name_key(p_name text) returns text
language sql immutable set search_path = ''
as $$ select lower(regexp_replace(coalesce(p_name, ''), '\s+', '', 'g')) $$;

-- 재료 태그 9개 안의 값만 남긴다
create or replace function public.ai_clean_tags(p_tags text[]) returns text[]
language sql immutable set search_path = ''
as $$
  select coalesce(array_agg(distinct t order by t), '{}')
  from unnest(coalesce(p_tags, '{}')) as t
  where t = any (public.ingredient_tags())
$$;

-- 저장, 판정. tags에는 더하기만 한다. 그 메뉴가 후보인 판을 모두 다시 판정한다(후보 화면이 실시간으로 바뀐다)
create or replace function public.ai_ingredient_apply(p_food_id bigint, p_tags text[], p_notes jsonb, p_model text)
returns text[]
language plpgsql security definer set search_path = ''
as $$
declare
  v_food public.foods;
  v_tags text[] := public.ai_clean_tags(p_tags);
  v_notes jsonb;
  v_sid uuid;
begin
  select * into v_food from public.foods where id = p_food_id;
  if v_food.id is null or not v_food.custom then
    raise exception 'not_custom_food';
  end if;
  -- 이유는 남긴 태그의 것만
  select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) into v_notes
  from jsonb_each_text(coalesce(p_notes, '{}'::jsonb)) as e(k, v)
  where k = any (v_tags);

  insert into public.ai_ingredient_cache (name_key, tags, notes, model)
  values (public.ai_name_key(v_food.name), v_tags, v_notes, p_model)
  on conflict (name_key) do nothing;

  update public.foods f
  set ai_tags = public.ai_clean_tags(f.ai_tags || v_tags),
      ai_notes = coalesce(f.ai_notes, '{}'::jsonb) || v_notes,
      ai_status = 'done',
      tags = array(select distinct t from unnest(f.tags || v_tags) as t order by t)
  where f.id = p_food_id;

  for v_sid in select distinct c.session_id from public.candidates c where c.food_id = p_food_id loop
    perform public.refresh_vetoes(v_sid);
  end loop;
  return v_tags;
end;
$$;

create or replace function public.ai_ingredient_failed(p_food_id bigint) returns void
language sql security definer set search_path = ''
as $$ update public.foods set ai_status = 'failed' where id = p_food_id and custom and ai_status = 'pending' $$;

-- 앱 사용자가 (Edge Function을 거쳐) 부른다. 묻기 전에 확인하고, 저장한 값이 있으면 바로 쓴다
-- 돌려주는 값: {action: 'cached'|'ask'|'skip', name, reason}
create or replace function public.ai_ingredient_request(p_food_id bigint) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_food public.foods;
  v_cache public.ai_ingredient_cache;
  v_day date := (now() at time zone 'Asia/Seoul')::date;
  v_calls int;
begin
  select * into v_food from public.foods where id = p_food_id;
  if v_food.id is null or not v_food.custom then
    raise exception 'not_custom_food';
  end if;
  if not exists (
    select 1 from public.candidates c
    join public.session_participants sp on sp.session_id = c.session_id and sp.user_id = v_uid
    where c.food_id = p_food_id
  ) then
    raise exception 'not_participant';
  end if;
  if v_food.ai_status = 'done' then
    return jsonb_build_object('action', 'skip', 'reason', 'done');
  end if;

  select * into v_cache from public.ai_ingredient_cache where name_key = public.ai_name_key(v_food.name);
  if v_cache.name_key is not null then
    perform public.ai_ingredient_apply(p_food_id, v_cache.tags, v_cache.notes, v_cache.model);
    return jsonb_build_object('action', 'cached');
  end if;
  if v_food.ai_status = 'pending' then
    return jsonb_build_object('action', 'skip', 'reason', 'pending');
  end if;

  insert into public.ai_usage (day, calls) values (v_day, 1)
  on conflict (day) do update set calls = public.ai_usage.calls + 1
  returning calls into v_calls;
  if v_calls > public.app_limit('AI_DAILY_MAX') then
    return jsonb_build_object('action', 'skip', 'reason', 'daily_limit');
  end if;

  update public.foods set ai_status = 'pending' where id = p_food_id;
  return jsonb_build_object('action', 'ask', 'name', v_food.name);
end;
$$;

-- 메뉴를 올린 사람이 재료를 더한다(빼기는 없다)
create or replace function public.add_custom_food_tag(p_session_id uuid, p_food_id bigint, p_tag text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
begin
  if not (p_tag = any (public.ingredient_tags())) then
    raise exception 'bad_tag';
  end if;
  if not exists (
    select 1 from public.candidates c join public.foods f on f.id = c.food_id
    where c.session_id = p_session_id and c.food_id = p_food_id and c.proposed_by = v_uid and f.custom
  ) then
    raise exception 'not_proposer';
  end if;
  update public.foods
  set tags = array(select distinct t from unnest(tags || array[p_tag]) as t order by t)
  where id = p_food_id;
  perform public.refresh_vetoes(p_session_id);
end;
$$;

revoke execute on function public.ai_ingredient_apply(bigint, text[], jsonb, text) from public, anon, authenticated;
revoke execute on function public.ai_ingredient_failed(bigint) from public, anon, authenticated;
grant execute on function public.ai_ingredient_apply(bigint, text[], jsonb, text) to service_role;
grant execute on function public.ai_ingredient_failed(bigint) to service_role;
revoke execute on function public.ai_ingredient_request(bigint) from public, anon;
grant execute on function public.ai_ingredient_request(bigint) to authenticated;
revoke execute on function public.add_custom_food_tag(uuid, bigint, text) from public, anon;
grant execute on function public.add_custom_food_tag(uuid, bigint, text) to authenticated;
