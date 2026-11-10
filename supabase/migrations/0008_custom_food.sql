-- 직접 적은 메뉴 (명세 4-9, 2026-11-10 더함).
-- 기본 음식 목록에 없는 메뉴도 이름을 적어 후보로 올린다. 재료 태그는 이름에 든 낱말로 짐작한다.
-- 여러 번 넣어도 같은 결과가 나오게 썼다(if not exists, or replace, on conflict). 0007은 #39가 쓴다.

alter table public.foods add column if not exists custom boolean not null default false;

-- 이름에 든 낱말 → 재료 태그. 애매하면 붙인다 (4-7 원칙: 못 먹을 수 있다 쪽).
-- 앱은 이 표를 읽지 않는다. 서버 함수만 쓴다
create table if not exists public.food_keywords (
  keyword text primary key,
  tags text[] not null check (tags <@ public.ingredient_tags())
);
alter table public.food_keywords enable row level security;

insert into public.food_keywords (keyword, tags) values
  ('돼지', '{pork}'), ('삼겹', '{pork}'), ('목살', '{pork}'), ('제육', '{pork,spicy}'), ('족발', '{pork}'),
  ('보쌈', '{pork}'), ('수육', '{pork,beef}'), ('순대', '{pork}'), ('돈까스', '{pork,wheat}'), ('돈가스', '{pork,wheat}'),
  ('카츠', '{pork,wheat}'), ('햄', '{pork}'), ('베이컨', '{pork}'), ('소시지', '{pork}'), ('차슈', '{pork}'),
  ('감자탕', '{pork,spicy}'), ('뼈해장', '{pork,spicy}'), ('탕수육', '{pork,wheat}'), ('짜장', '{pork,wheat}'),
  ('짬뽕', '{pork,seafood,wheat,spicy}'),
  ('소고기', '{beef}'), ('쇠고기', '{beef}'), ('한우', '{beef}'), ('불고기', '{beef}'), ('육회', '{beef}'),
  ('차돌', '{beef}'), ('양지', '{beef}'), ('스테이크', '{beef}'), ('갈비', '{beef,pork}'), ('곱창', '{beef,pork}'),
  ('대창', '{beef,pork}'), ('막창', '{beef,pork}'), ('설렁탕', '{beef}'), ('곰탕', '{beef}'), ('육개장', '{beef,spicy}'),
  ('규동', '{beef}'), ('함박', '{beef,pork}'), ('버거', '{beef,wheat,dairy}'), ('냉면', '{beef,wheat}'),
  ('닭', '{chicken}'), ('치킨', '{chicken,wheat}'), ('삼계', '{chicken}'), ('백숙', '{chicken}'), ('너겟', '{chicken,wheat}'),
  ('가라아게', '{chicken,wheat}'),
  ('해물', '{seafood}'), ('해산', '{seafood}'), ('새우', '{seafood}'), ('오징어', '{seafood}'), ('조개', '{seafood}'),
  ('굴', '{seafood}'), ('연어', '{seafood}'), ('참치', '{seafood}'), ('회', '{seafood}'), ('초밥', '{seafood}'),
  ('스시', '{seafood}'), ('생선', '{seafood}'), ('꽃게', '{seafood}'), ('게살', '{seafood}'), ('랍스터', '{seafood}'),
  ('낙지', '{seafood,spicy}'), ('주꾸미', '{seafood,spicy}'), ('쭈꾸미', '{seafood,spicy}'), ('문어', '{seafood}'),
  ('어묵', '{seafood,wheat}'), ('오뎅', '{seafood,wheat}'), ('멸치', '{seafood}'), ('고등어', '{seafood}'),
  ('갈치', '{seafood}'), ('장어', '{seafood}'), ('명란', '{seafood}'), ('매운탕', '{seafood,spicy}'), ('포케', '{seafood}'),
  ('면', '{wheat}'), ('국수', '{wheat}'), ('라면', '{wheat,spicy}'), ('라멘', '{wheat,pork}'), ('우동', '{wheat}'),
  ('소바', '{wheat}'), ('파스타', '{wheat}'), ('스파게티', '{wheat}'), ('빵', '{wheat}'), ('피자', '{wheat,dairy}'),
  ('만두', '{wheat,pork}'), ('수제비', '{wheat}'), ('떡볶이', '{wheat,spicy}'), ('튀김', '{wheat}'), ('샌드위치', '{wheat}'),
  ('토스트', '{wheat}'), ('부침', '{wheat}'), ('파전', '{wheat,seafood}'),
  ('치즈', '{dairy}'), ('크림', '{dairy}'), ('우유', '{dairy}'), ('버터', '{dairy}'), ('까르보', '{dairy,wheat}'),
  ('리조또', '{dairy}'), ('그라탕', '{dairy,wheat}'),
  ('땅콩', '{nuts}'), ('견과', '{nuts}'), ('아몬드', '{nuts}'), ('호두', '{nuts}'), ('캐슈', '{nuts}'),
  ('매운', '{spicy}'), ('매콤', '{spicy}'), ('마라', '{spicy}'), ('불닭', '{spicy,chicken}'), ('김치', '{spicy}'),
  ('고추', '{spicy}'), ('얼큰', '{spicy}'), ('엽떡', '{spicy,wheat}')
on conflict (keyword) do nothing;

-- 이름으로 재료 태그를 짐작한다. 목록에 있는 음식 이름이 들어 있으면 그 음식의 재료 태그를 받고(예: "치즈김밥" ⊃ "김밥"),
-- 낱말 표의 태그를 더한다. 식단 표시(halal_ok, veg_ok, vegan_ok)는 붙이지 않는다.
-- 그래서 할랄, 채식, 비건을 등록한 사람이 있으면 직접 적은 메뉴는 빠진다
create or replace function public.guess_food_tags(p_name text) returns text[]
language sql stable set search_path = ''
as $$
  select coalesce(array(
    select distinct t from (
      select unnest(f.tags) as t from public.foods f
      where not f.custom and strpos(p_name, f.name) > 0
      union
      select unnest(k.tags) from public.food_keywords k
      where strpos(p_name, k.keyword) > 0
    ) x
    where t = any (public.ingredient_tags())
    order by t
  ), '{}'::text[])
$$;

create or replace function public.app_limits() returns jsonb
language sql immutable set search_path = ''
as $$
  select '{"GROUP_NAME_MAX": 40, "DISPLAY_NAME_MAX": 20, "INVITE_CODE_LENGTH": 6, "PITCH_MAX": 60, "MAX_VOTES_PER_PERSON": 2, "HANDLE_MIN": 3, "HANDLE_MAX": 16, "QUIZ_LENGTH": 8, "FOOD_NAME_MAX": 20}'::jsonb
$$;

-- 이름을 적어 후보로 올린다. 같은 이름이 목록에 있으면 그 음식으로 올린다.
-- 확인(로그인, 소속, 판 참여, 후보 단계)을 먼저 하고 나서 음식을 만든다. 돌려주는 값: 음식 id와 빠졌는지
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
  v_name := public.clean_name(p_name, public.app_limit('FOOD_NAME_MAX'));

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

-- 직접 적은 메뉴 이름은 그 메뉴가 후보로 오른 판의 사람에게만 보인다. 기본 목록은 모두에게 보인다
drop policy if exists foods_select on public.foods;
create policy foods_select on public.foods
  for select to authenticated using (
    not custom
    or exists (
      select 1 from public.candidates c
      where c.food_id = foods.id and public.is_session_member(c.session_id)
    )
  );

revoke execute on function public.guess_food_tags(text) from public, anon, authenticated;
revoke execute on function public.add_custom_candidate(uuid, text) from public, anon;
grant execute on function public.add_custom_candidate(uuid, text) to authenticated;
