-- 0044 못 먹는 것 경고를 두 단계로 (명세 4-7, 4-9, 4-22, 2026-11-25)
-- 병주: "제약이나 못 먹는 것들이 너무 빡빡하게 규정되어서 괜찮은데 안 괜찮아지는 버그가 있으면 안 됨"
-- 1. 확실(foods.tags): 기본 메뉴 태그, 낱말 표, 사람이 더한 태그. 걸리면 지금처럼 "못 먹는 사람이 있어요"(candidates.vetoed)
--    약함(foods.ai_tags 중 tags에 없는 것): AI만 추정한 태그. 걸리면 "OO 들어갈 수 있어요"(candidates.maybe_tags)
--    어느 쪽도 후보를 빼거나 투표를 막지 않는다(0010 그대로). 0023은 AI 태그를 tags에 합쳐서 가게 이름(백소정 등)에도 확실 경고가 붙었다
-- 2. AI 답: 태그마다 기본 레시피(recipe)인지 가게마다 다름(varies)인지, 메뉴 이름인지(is_menu). 답마다 기록(ai_answers)
-- 3. 입력 정제(이모지, 특수문자, 겹친 공백), 출력 정제(9개 밖, 빈 근거, 금칙어나 주소가 든 근거), 지시문 같은 이름은 캐시하지 않음
-- 4. 사람별 하루 상한, 사람 확인(맞아요, 재료 더하기만. 빼기 없음)과 기록(ai_feedback)
-- 5. 식단 둘 더함: 힌두교(소고기), 페스코(돼지, 소, 닭). 할랄은 돼지고기 그대로
-- 6. 낱말 표 오발 막기(food_keyword_skips): 햄버거의 "햄", 닭갈비의 "갈비", 충무김밥의 "김밥" 등
-- 여러 번 넣어도 같게 썼다(if not exists, or replace, on conflict).

-- 규칙 숫자 (AI 함수만 쓴다)
create or replace function public.ai_rule(p_name text) returns int
language sql immutable set search_path = ''
as $$ select ('{"AI_USER_DAILY_MAX": 20, "AI_PROMPT_VERSION": 2}'::jsonb ->> p_name)::int $$;
revoke execute on function public.ai_rule(text) from public, anon, authenticated;

-- 칸 -----------------------------------------------------------------------
alter table public.foods add column if not exists ai_basis jsonb;
alter table public.foods add column if not exists ai_prompt_version int;
alter table public.foods add column if not exists human_tags text[] not null default '{}';
alter table public.foods drop constraint if exists foods_ai_status_check;
alter table public.foods add constraint foods_ai_status_check
  check (ai_status is null or ai_status in ('pending', 'done', 'failed', 'not_menu'));

alter table public.candidates add column if not exists maybe_tags text[] not null default '{}';
alter table public.candidates add column if not exists ai_checked_at timestamptz;

alter table public.ai_ingredient_cache add column if not exists basis jsonb;
alter table public.ai_ingredient_cache add column if not exists is_menu boolean not null default true;
alter table public.ai_ingredient_cache add column if not exists prompt_version int;

-- AI 답마다 한 줄 (10팀처럼): 모델, 프롬프트 판, 받은 시각, 실패 이유, 버린 태그 수. 사람은 적지 않는다
create table if not exists public.ai_answers (
  id bigint generated always as identity primary key,
  food_id bigint references public.foods (id) on delete cascade,
  name_key text not null,
  model text,
  prompt_version int,
  received_at timestamptz not null default now(),
  fail_reason text,
  is_menu boolean,
  tag_count int not null default 0,
  dropped int not null default 0
);
alter table public.ai_answers enable row level security;
revoke all on public.ai_answers from anon, authenticated;

-- 사람 확인 기록 (11팀처럼). 계정을 지우면 같이 지운다
create table if not exists public.ai_feedback (
  id bigint generated always as identity primary key,
  food_id bigint not null references public.foods (id) on delete cascade,
  session_id uuid references public.sessions (id) on delete set null,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('confirm', 'add')),
  tag text,
  ai_tags text[] not null default '{}',
  prompt_version int,
  created_at timestamptz not null default now()
);
alter table public.ai_feedback enable row level security;
revoke all on public.ai_feedback from anon, authenticated;

-- 사람별 하루 AI 호출 수 (한국 날짜). 계정을 지우면 같이 지운다
create table if not exists public.ai_user_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  calls int not null default 0,
  primary key (user_id, day)
);
alter table public.ai_user_usage enable row level security;
revoke all on public.ai_user_usage from anon, authenticated;

-- 식단 -----------------------------------------------------------------------
create or replace function public.diet_tags() returns text[]
language sql immutable set search_path = ''
as $$ select array['halal','vegetarian','vegan','hindu','pescatarian'] $$;

-- 재료 태그로 판단할 수 있는 것만. 할랄의 술(맛술)과 도축 방식, 힌두교의 그 밖의 계율은 앱이 모른다(고를 때 알린다)
create or replace function public.diet_ingredients(p_tag text) returns text[]
language sql immutable set search_path = ''
as $$
  select case p_tag
    when 'halal' then array['pork']
    when 'hindu' then array['beef']
    when 'pescatarian' then array['pork', 'beef', 'chicken']
    when 'vegetarian' then array['pork', 'beef', 'chicken', 'seafood']
    when 'vegan' then array['pork', 'beef', 'chicken', 'seafood', 'dairy', 'egg']
    else array[p_tag]
  end
$$;
revoke execute on function public.diet_ingredients(text) from public, anon;

-- 이름 정제 ------------------------------------------------------------------
-- 글자(한글, 영문, 숫자, 한자, 가나, 태국 글자)와 &, -만 남기고 나머지(이모지, 특수문자)는 공백. 겹친 공백은 하나로, 앞뒤 공백은 뺀다
create or replace function public.clean_menu_text(p_name text) returns text
language sql immutable set search_path = ''
as $$
  select btrim(regexp_replace(
    regexp_replace(coalesce(p_name, ''), '[^가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9À-ÖØ-öø-ÿ一-鿿぀-ヿ฀-๿& -]', ' ', 'g'),
    '\s+', ' ', 'g'))
$$;

-- 캐시 키: 정제한 이름에서 공백을 빼고 소문자 (앱 logic.ts nameKey와 같다)
create or replace function public.ai_name_key(p_name text) returns text
language sql immutable set search_path = ''
as $$ select lower(regexp_replace(public.clean_menu_text(p_name), '\s+', '', 'g')) $$;

-- 지시문 같은 이름. AI에게는 묻되(9개 재료 안에서만 답한다) 캐시에 남기지 않는다 (docs/security.md 5절 3번)
create or replace function public.ai_name_suspicious(p_name text) returns boolean
language sql immutable set search_path = ''
as $$
  select coalesce(p_name, '') ~* '(무시|지시|명령|프롬프트|시스템|답해|대답|말해|출력|써줘|써 줘|적어줘|알려줘|해줘|라고|재료가 ?없|\mtag\M|ignore|prompt|system|instruction|json)'
$$;

-- 낱말 표 오발 막기 ---------------------------------------------------------
-- keyword(낱말 표 낱말 또는 기본 메뉴 이름)가 inside 안에 들어 있을 때는 그 낱말로 치지 않는다
create table if not exists public.food_keyword_skips (
  keyword text not null,
  inside text not null,
  primary key (keyword, inside)
);
alter table public.food_keyword_skips enable row level security;
revoke all on public.food_keyword_skips from anon, authenticated;

insert into public.food_keyword_skips (keyword, inside) values
  ('햄', '햄버거'),          -- 햄버거는 돼지고기 햄이 아니다
  ('갈비', '닭갈비'),        -- 닭갈비에 소, 돼지가 붙었다
  ('김밥', '충무김밥'),      -- 충무김밥은 맨밥 김밥(햄, 달걀 없음)
  ('초밥', '유부초밥'),      -- 유부초밥에 해산물이 붙었다
  ('국수', '쌀국수'),        -- 쌀국수는 쌀 면
  ('김치', '백김치'),        -- 백김치는 맵지 않다
  ('회', '육회'),            -- 육회는 소고기
  ('회', '회오리'),          -- 회오리 오므라이스
  ('돈까스', '치킨돈까스'), ('돈가스', '치킨돈가스'),
  ('카츠', '치킨카츠'), ('카츠', '규카츠'), ('카츠', '에비카츠')
on conflict do nothing;

create or replace function public.strip_words(p_text text, p_words text[]) returns text
language plpgsql immutable set search_path = ''
as $$
declare
  v text := coalesce(p_text, '');
  w text;
begin
  foreach w in array coalesce(p_words, '{}'::text[]) loop
    v := replace(v, w, ' ');
  end loop;
  return v;
end;
$$;

create or replace function public.guess_food_tags(p_name text) returns text[]
language sql stable set search_path = ''
as $$
  select coalesce(array(
    select distinct t from (
      select unnest(f.tags) as t from public.foods f
      where not f.custom and strpos(
        public.strip_words(p_name, array(select s.inside from public.food_keyword_skips s where s.keyword = f.name)),
        f.name) > 0
      union
      select unnest(k.tags) from public.food_keywords k
      where strpos(
        public.strip_words(p_name, array(select s.inside from public.food_keyword_skips s where s.keyword = k.keyword)),
        k.keyword) > 0
    ) x
    where t = any (public.ingredient_tags())
    order by t
  ), '{}'::text[])
$$;
revoke execute on function public.guess_food_tags(text) from public, anon, authenticated;

-- 판정 -----------------------------------------------------------------------
-- vetoed: 확실한 태그(tags)나 직접 고른 음식이 걸린다. maybe_tags: AI만 추정한 태그 중 이 판 누군가의 못 먹는 것에 걸리는 것
create or replace function public.refresh_vetoes(p_session_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.candidates c
  set vetoed = exists (
      select 1
      from public.session_participants sp
      join public.restrictions r on r.user_id = sp.user_id
      join public.foods f on f.id = c.food_id
      where sp.session_id = c.session_id
        and public.restriction_blocks(f.id, f.tags, r.tag, r.food_id)
    ),
    maybe_tags = coalesce((
      select array_agg(distinct t order by t)
      from public.foods f
      cross join lateral unnest(f.ai_tags) as t
      where f.id = c.food_id
        and not (t = any (f.tags))
        and exists (
          select 1 from public.session_participants sp
          join public.restrictions r on r.user_id = sp.user_id and r.tag is not null
          where sp.session_id = c.session_id and t = any (public.diet_ingredients(r.tag))
        )
    ), '{}'::text[])
  where c.session_id = p_session_id;
end;
$$;

-- AI 결과 저장 ---------------------------------------------------------------
-- 음식 칸에만 쓴다. tags(확실)는 건드리지 않는다
create or replace function public.ai_set_food(
  p_food_id bigint, p_tags text[], p_notes jsonb, p_basis jsonb, p_is_menu boolean, p_prompt_version int
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_sid uuid;
begin
  update public.foods
  set ai_tags = case when p_is_menu then public.ai_clean_tags(p_tags) else '{}'::text[] end,
      ai_notes = case when p_is_menu then coalesce(p_notes, '{}'::jsonb) else '{}'::jsonb end,
      ai_basis = case when p_is_menu then coalesce(p_basis, '{}'::jsonb) else '{}'::jsonb end,
      ai_status = case when p_is_menu then 'done' else 'not_menu' end,
      ai_prompt_version = p_prompt_version
  where id = p_food_id;
  for v_sid in select distinct c.session_id from public.candidates c where c.food_id = p_food_id loop
    perform public.refresh_vetoes(v_sid);
  end loop;
end;
$$;

-- Edge Function이 service role로 부른다. 출력 정제: 9개 밖, 겹침, 빈 근거, 금칙어나 주소가 든 근거는 버리고 버린 수를 남긴다
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

-- 0023 모양(4개 인자)으로 부르는 예전 함수도 같은 규칙으로(약한 단계, 판 1)
create or replace function public.ai_ingredient_apply(p_food_id bigint, p_tags text[], p_notes jsonb, p_model text)
returns text[]
language sql security definer set search_path = ''
as $$ select public.ai_ingredient_apply(p_food_id, p_tags, p_notes, p_model, '{}'::jsonb, true, 1, 0) $$;

-- 실패 이유 코드와 함께 (no_key, timeout, http_429, parse, apply_failed 등)
create or replace function public.ai_ingredient_failed(p_food_id bigint, p_reason text, p_model text, p_prompt_version int)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.foods set ai_status = 'failed' where id = p_food_id and custom and ai_status = 'pending';
  insert into public.ai_answers (food_id, name_key, model, prompt_version, fail_reason)
  select f.id, public.ai_name_key(f.name), p_model, p_prompt_version, left(coalesce(p_reason, 'unknown'), 40)
  from public.foods f where f.id = p_food_id and f.custom;
end;
$$;

create or replace function public.ai_ingredient_failed(p_food_id bigint) returns void
language sql security definer set search_path = ''
as $$ select public.ai_ingredient_failed(p_food_id, 'unknown', null, null) $$;

-- 앱 사용자가 (Edge Function을 거쳐) 부른다. 돌려주는 값: {action: 'cached'|'ask'|'skip', name, reason}
-- 더한 것: 정제한 이름 키, 지금 프롬프트 판의 캐시만, 예전 판 답은 다시 묻기, 사람별 하루 상한
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
  return jsonb_build_object('action', 'ask', 'name', v_food.name);
end;
$$;

-- 직접 적기: 이름을 정제해서 찾고 만든다(나머지는 0008 그대로)
create or replace function public.add_custom_candidate(p_session_id uuid, p_name text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_session public.sessions := public.lock_session(p_session_id, v_uid);
  v_name text;
  v_food_id bigint;
begin
  perform public.require_participant(p_session_id, v_uid);
  if v_session.status <> 'open' then
    raise exception 'voting_started';
  end if;
  v_name := public.clean_name(public.clean_menu_text(p_name), public.app_limit('FOOD_NAME_MAX'));

  select id into v_food_id from public.foods where name = v_name;
  if v_food_id is null then
    insert into public.foods (name, tags, cuisine, custom)
    values (v_name, public.guess_food_tags(v_name), 'custom', true)
    on conflict (name) do nothing
    returning id into v_food_id;
    if v_food_id is null then
      select id into v_food_id from public.foods where name = v_name;
    end if;
  end if;

  return jsonb_build_object(
    'food_id', v_food_id,
    'vetoed', public.add_candidate(p_session_id, v_food_id)
  );
end;
$$;

-- 사람 확인 (올린 사람만) ----------------------------------------------------
-- 맞아요: 기록만 남기고 단계는 그대로(AI 태그는 약한 표시 그대로)
create or replace function public.confirm_custom_food(p_session_id uuid, p_food_id bigint) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_food public.foods;
begin
  if not exists (
    select 1 from public.candidates c join public.foods f on f.id = c.food_id
    where c.session_id = p_session_id and c.food_id = p_food_id and c.proposed_by = v_uid and f.custom
  ) then
    raise exception 'not_proposer';
  end if;
  select * into v_food from public.foods where id = p_food_id;
  insert into public.ai_feedback (food_id, session_id, user_id, kind, ai_tags, prompt_version)
  values (p_food_id, p_session_id, v_uid, 'confirm', v_food.ai_tags, v_food.ai_prompt_version);
  update public.candidates set ai_checked_at = now()
  where session_id = p_session_id and food_id = p_food_id;
end;
$$;

-- 재료 더하기: 확실 단계로 올린다(빼기는 없다). 기록을 남긴다
create or replace function public.add_custom_food_tag(p_session_id uuid, p_food_id bigint, p_tag text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_food public.foods;
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
  select * into v_food from public.foods where id = p_food_id;
  update public.foods
  set tags = array(select distinct t from unnest(tags || array[p_tag]) as t order by t),
      human_tags = array(select distinct t from unnest(human_tags || array[p_tag]) as t order by t)
  where id = p_food_id;
  insert into public.ai_feedback (food_id, session_id, user_id, kind, tag, ai_tags, prompt_version)
  values (p_food_id, p_session_id, v_uid, 'add', p_tag, v_food.ai_tags, v_food.ai_prompt_version);
  perform public.refresh_vetoes(p_session_id);
end;
$$;

-- 권한 -----------------------------------------------------------------------
revoke execute on function public.ai_set_food(bigint, text[], jsonb, jsonb, boolean, int) from public, anon, authenticated;
revoke execute on function public.ai_ingredient_apply(bigint, text[], jsonb, text, jsonb, boolean, int, int) from public, anon, authenticated;
revoke execute on function public.ai_ingredient_apply(bigint, text[], jsonb, text) from public, anon, authenticated;
revoke execute on function public.ai_ingredient_failed(bigint, text, text, int) from public, anon, authenticated;
revoke execute on function public.ai_ingredient_failed(bigint) from public, anon, authenticated;
grant execute on function public.ai_ingredient_apply(bigint, text[], jsonb, text, jsonb, boolean, int, int) to service_role;
grant execute on function public.ai_ingredient_apply(bigint, text[], jsonb, text) to service_role;
grant execute on function public.ai_ingredient_failed(bigint, text, text, int) to service_role;
grant execute on function public.ai_ingredient_failed(bigint) to service_role;
revoke execute on function public.ai_ingredient_request(bigint) from public, anon;
grant execute on function public.ai_ingredient_request(bigint) to authenticated;
revoke execute on function public.confirm_custom_food(uuid, bigint) from public, anon;
grant execute on function public.confirm_custom_food(uuid, bigint) to authenticated;
revoke execute on function public.add_custom_food_tag(uuid, bigint, text) from public, anon;
grant execute on function public.add_custom_food_tag(uuid, bigint, text) to authenticated;
revoke execute on function public.add_custom_candidate(uuid, text) from public, anon;
grant execute on function public.add_custom_candidate(uuid, text) to authenticated;
revoke execute on function public.clean_menu_text(text), public.ai_name_key(text), public.ai_name_suspicious(text),
  public.strip_words(text, text[]) from public, anon, authenticated;

-- 이미 저장된 직접 적은 메뉴 -------------------------------------------------
-- AI가 tags에 합친 것을 걷어 낸다: 확실 = 낱말 표(새 오발 막기 적용) + 사람이 더한 것. AI 답은 ai_tags에 남아 약한 표시로만 보인다
update public.foods f
set tags = array(select distinct t from unnest(public.guess_food_tags(f.name) || f.human_tags) as t order by t)
where f.custom
  and f.tags is distinct from array(select distinct t from unnest(public.guess_food_tags(f.name) || f.human_tags) as t order by t);

do $$
declare s record;
begin
  for s in select id from public.sessions where status <> 'done' loop
    perform public.refresh_vetoes(s.id);
  end loop;
end $$;
