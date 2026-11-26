-- 0055 사람 정답표로 찾은 재료 추정 오류를 고친다 (명세 4-22, 2026-11-26)
-- python/03_human_answer_key.py(팀원 세 명 다수결)로 재 보니 판 2가 "빵"을 메뉴 아님으로 보고 유제품, 달걀을 놓쳤다.
-- 원인: 프롬프트 1번이 넓은 음식 이름 한 낱말을 메뉴로 보라는 말이 없어 모델이 답마다 메뉴 아님과 메뉴를 오갔고,
--       서버는 낱말 표에 "빵"(밀가루)이 있다는 것을 알면서도 AI의 메뉴 아님 판단을 그대로 받았다. 입력 정제는 "빵"을 바꾸지 않았다.
-- 1. 음식 낱말 판단 ai_is_food_word: 정제한 이름(공백 빼고)이 낱말 표 낱말, 기본 메뉴 이름, 흔한 음식 낱말(food_plain_words)과 똑같을 때만 참.
--    "찌개찌개", "보배반점", "병천순대"처럼 낱말이 들어 있기만 한 가게 이름은 거짓이라 지금처럼 태그가 없다
-- 2. ai_ingredient_request의 ask 답에 food_word를 더한다. 참이면 Edge Function이 프롬프트에 "음식 이름이다" 한 줄을 붙인다
-- 3. ai_ingredient_apply: 음식 낱말인데 모델이 메뉴 아님이라 하면 메뉴로 둔다(안전망)
-- 4. 프롬프트 판 3(소스, 육수, 곁들임 재료를 빠짐없이). 예전 판 답은 다음에 판이 열릴 때 다시 묻는다. ai_answers 기록은 그대로 쌓인다
-- 여러 번 넣어도 같게 썼다(if not exists, or replace, on conflict).

create or replace function public.ai_rule(p_name text) returns int
language sql immutable set search_path = ''
as $$ select ('{"AI_USER_DAILY_MAX": 20, "AI_PROMPT_VERSION": 3}'::jsonb ->> p_name)::int $$;
revoke execute on function public.ai_rule(text) from public, anon, authenticated;

-- 흔한 음식 낱말. 낱말 표(food_keywords)는 확실 태그를 주는 낱말이라, 태그 없이 "음식 이름"인 것만 따로 둔다
create table if not exists public.food_plain_words (
  word text primary key
);
alter table public.food_plain_words enable row level security;
revoke all on public.food_plain_words from anon, authenticated;
insert into public.food_plain_words (word) values
  ('빵'), ('떡'), ('국수'), ('고기'), ('밥'), ('면'), ('죽'), ('국'), ('탕'), ('찌개'), ('전'), ('튀김'), ('회'),
  ('만두'), ('과자'), ('케이크'), ('디저트'), ('음료'), ('커피'), ('차'), ('샐러드'), ('도시락'), ('반찬'), ('과일'), ('아이스크림')
on conflict do nothing;

create or replace function public.ai_is_food_word(p_name text) returns boolean
language sql stable set search_path = ''
as $$
  select public.ai_name_key(p_name) <> '' and (
    exists (select 1 from public.food_plain_words w where public.ai_name_key(w.word) = public.ai_name_key(p_name))
    or exists (select 1 from public.food_keywords k where public.ai_name_key(k.keyword) = public.ai_name_key(p_name))
    or exists (select 1 from public.foods f where not f.custom and public.ai_name_key(f.name) = public.ai_name_key(p_name))
  )
$$;
revoke execute on function public.ai_is_food_word(text) from public, anon, authenticated;

-- 앱 사용자가 (Edge Function을 거쳐) 부른다. ask 답에 food_word(음식 낱말인지)를 더했다. 나머지는 0044 그대로
create or replace function public.ai_ingredient_request(p_food_id bigint) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_food public.foods;
  v_cache public.ai_ingredient_cache;
  v_day date := (now() at time zone 'Asia/Seoul')::date;
  v_ver int := public.ai_rule('AI_PROMPT_VERSION');
  v_calls int;
  v_mine int;
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
  if v_food.ai_status in ('done', 'not_menu') and coalesce(v_food.ai_prompt_version, 1) >= v_ver then
    return jsonb_build_object('action', 'skip', 'reason', 'done');
  end if;

  select * into v_cache from public.ai_ingredient_cache
  where name_key = public.ai_name_key(v_food.name) and coalesce(prompt_version, 1) >= v_ver;
  if v_cache.name_key is not null then
    perform public.ai_set_food(p_food_id, v_cache.tags, v_cache.notes, v_cache.basis, v_cache.is_menu, v_cache.prompt_version);
    return jsonb_build_object('action', 'cached');
  end if;
  if v_food.ai_status in ('pending', 'failed') and v_food.ai_tried_at > now() - interval '10 minutes' then
    return jsonb_build_object('action', 'skip', 'reason', v_food.ai_status);
  end if;

  insert into public.ai_user_usage (user_id, day, calls) values (v_uid, v_day, 1)
  on conflict (user_id, day) do update set calls = public.ai_user_usage.calls + 1
  returning calls into v_mine;
  delete from public.ai_user_usage where day < v_day - 7;
  if v_mine > public.ai_rule('AI_USER_DAILY_MAX') then
    return jsonb_build_object('action', 'skip', 'reason', 'user_limit');
  end if;

  insert into public.ai_usage (day, calls) values (v_day, 1)
  on conflict (day) do update set calls = public.ai_usage.calls + 1
  returning calls into v_calls;
  if v_calls > public.app_limit('AI_DAILY_MAX') then
    return jsonb_build_object('action', 'skip', 'reason', 'daily_limit');
  end if;

  update public.foods set ai_status = 'pending', ai_tried_at = now() where id = p_food_id;
  return jsonb_build_object('action', 'ask', 'name', v_food.name, 'food_word', public.ai_is_food_word(v_food.name));
end;
$$;

-- Edge Function이 service role로 부른다. 음식 낱말 안전망을 더했다. 나머지는 0044 그대로
create or replace function public.ai_ingredient_apply(
  p_food_id bigint, p_tags text[], p_notes jsonb, p_model text,
  p_basis jsonb, p_is_menu boolean, p_prompt_version int, p_dropped int
) returns text[]
language plpgsql security definer set search_path = ''
as $$
declare
  v_food public.foods;
  v_is_menu boolean := coalesce(p_is_menu, true);
  v_tags text[] := '{}';
  v_notes jsonb := '{}'::jsonb;
  v_basis jsonb := '{}'::jsonb;
  v_drop int := greatest(coalesce(p_dropped, 0), 0);
  v_why text;
  t text;
begin
  select * into v_food from public.foods where id = p_food_id;
  if v_food.id is null or not v_food.custom then
    raise exception 'not_custom_food';
  end if;
  -- 음식 낱말과 똑같은 이름(빵, 국수 등)은 모델이 메뉴 아님이라 해도 메뉴로 둔다. 가게 이름은 여기에 걸리지 않는다
  if not v_is_menu and public.ai_is_food_word(v_food.name) then
    v_is_menu := true;
  end if;
  foreach t in array coalesce(p_tags, '{}'::text[]) loop
    if not v_is_menu then
      v_drop := v_drop + 1;
      continue;
    end if;
    if t = any (v_tags) then
      continue;
    end if;
    v_why := btrim(coalesce(p_notes ->> t, ''));
    if not (t = any (public.ingredient_tags())) or v_why = '' or public.has_blocked_word(v_why)
      or v_why ~* '(https?:|www\.|\.com|\.kr|\.net|@)' then
      v_drop := v_drop + 1;
      continue;
    end if;
    v_tags := v_tags || t;
    v_notes := v_notes || jsonb_build_object(t, left(v_why, 60));
    v_basis := v_basis || jsonb_build_object(t, case when p_basis ->> t = 'recipe' then 'recipe' else 'varies' end);
  end loop;
  v_tags := public.ai_clean_tags(v_tags);

  if not public.ai_name_suspicious(v_food.name) then
    insert into public.ai_ingredient_cache as k (name_key, tags, notes, model, basis, is_menu, prompt_version)
    values (public.ai_name_key(v_food.name), v_tags, v_notes, p_model, v_basis, v_is_menu, p_prompt_version)
    on conflict (name_key) do update
      set tags = excluded.tags, notes = excluded.notes, model = excluded.model, basis = excluded.basis,
          is_menu = excluded.is_menu, prompt_version = excluded.prompt_version, created_at = now()
      where coalesce(k.prompt_version, 1) < coalesce(excluded.prompt_version, 1);
  end if;

  insert into public.ai_answers (food_id, name_key, model, prompt_version, is_menu, tag_count, dropped)
  values (p_food_id, public.ai_name_key(v_food.name), p_model, p_prompt_version, v_is_menu,
          coalesce(array_length(v_tags, 1), 0), v_drop);

  perform public.ai_set_food(p_food_id, v_tags, v_notes, v_basis, v_is_menu, p_prompt_version);
  return v_tags;
end;
$$;

revoke execute on function public.ai_ingredient_apply(bigint, text[], jsonb, text, jsonb, boolean, int, int) from public, anon, authenticated;
grant execute on function public.ai_ingredient_apply(bigint, text[], jsonb, text, jsonb, boolean, int, int) to service_role;
revoke execute on function public.ai_ingredient_request(bigint) from public, anon;
grant execute on function public.ai_ingredient_request(bigint) to authenticated;
