-- 결과 뒤 "이 메뉴 파는 학교 앞", 투표 화면 추천 칸, "먹고 나서 카페"의 순서 (명세 4-21, 4-23, 4-29, 2026-11-25).
-- 순서: (1) 쿠폰 가게(혜택 문구가 있는 제휴, "광고") (2) 내 단과대나 총학생회의 학생회 제휴 가게 (3) 정문에서 가까운 순.
-- 학생회 제휴는 우리와 돈 관계가 없는 학생 혜택이라 "광고"를 붙이지 않는다. 행마다 학생회 혜택 첫 줄을 같이 준다.
-- 내 단과대는 부른 사람 자신의 취향(my_prefs)에서만 읽는다. 같은 판 다른 사람의 단과대는 쓰지 않는다(개인정보).
-- 3곳보다 많으면 화면이 "더 보기"를 그리도록 맞는 가게 수(total_count)를 같이 준다.
-- 여러 번 돌려도 같다(돌려주는 칸이 바뀌어 함수를 지우고 다시 만든다).

-- 학생회 혜택 원문의 첫 줄. 빈 줄과 괄호만 있는 줄("(여름 한정)")은 건너뛰고, 앞 번호("1. ")는 뗀다
create or replace function public.council_first_line(p_benefit text)
returns text
language sql immutable set search_path = ''
as $$
  select nullif(btrim(regexp_replace(btrim(t.line), '^[0-9]+[.)][[:space:]]*', '')), '')
  from regexp_split_to_table(coalesce(p_benefit, ''), E'\n') with ordinality as t(line, n)
  where btrim(t.line) <> '' and btrim(t.line) !~ '^\(.*\)$'
  order by t.n
  limit 1
$$;

-- 이 가게의 학생회 제휴 중 부른 사람에게 보일 하나: 내 단과대가 총학생회보다, 혜택 문구가 있는 것이 먼저
create or replace function public.my_council_pick(p_restaurant_id bigint, p_college text)
returns table (college text, benefit text)
language sql stable set search_path = ''
as $$
  select b.college, public.council_first_line(b.benefit)
  from public.council_benefits b
  where b.show_in_app and b.restaurant_id = p_restaurant_id
    and (b.college = 'all' or (p_college is not null and b.college = p_college))
  order by (b.college = 'all'), (public.council_first_line(b.benefit) is null), b.id
  limit 1
$$;

drop function if exists public.session_cafes(uuid);
create function public.session_cafes(p_session_id uuid)
returns table (id bigint, name text, partner boolean, coupon_text text, my_code text, lat double precision, lng double precision,
  council_college text, council_text text, total_count integer)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_session public.sessions;
  v_area text;
  v_college text := public.my_prefs() ->> 'college';
begin
  select * into v_session from public.sessions s where s.id = p_session_id;
  if not found or not public.is_session_member(p_session_id) then
    raise exception 'not_member';
  end if;
  if v_session.status <> 'done' then
    raise exception 'not_done';
  end if;
  select g.area into v_area from public.groups g where g.id = v_session.group_id;

  return query
  with picked as (
    select r.id, r.name, r.lat, r.lng, r.coupon_text,
      public.shop_has_offer(r.partner, r.coupon_text) as offer,
      cp.college as council_college, cp.benefit as council_text,
      -- 정문에서 가까운 순(평면 근사, 1km 안이라 순서만 맞으면 된다). 정문을 모르는 동네는 ERICA 정문, 좌표가 없으면 맨 뒤
      (select power(r.lat - coalesce(max(g.lat), 37.2998), 2) + power((r.lng - coalesce(max(g.lng), 126.8369)) * 0.794, 2)
       from public.area_gate(r.area) g) as dist
    from public.restaurants r
    left join lateral public.my_council_pick(r.id, v_college) cp on true
    where r.area = v_area and r.cuisine = 'cafe'
  )
  select p.id, p.name, p.offer,
    case when p.offer then p.coupon_text end,
    (select c.code from public.coupon_claims c
     where c.session_id = p_session_id and c.restaurant_id = p.id and c.user_id = v_uid),
    p.lat, p.lng, p.council_college, p.council_text,
    (count(*) over ())::int
  from picked p
  order by p.offer desc, (p.council_college is not null) desc, p.dist nulls last, p.id
  limit 3;
end;
$$;

drop function if exists public.session_restaurants(uuid);
create function public.session_restaurants(p_session_id uuid)
returns table (id bigint, name text, cuisine text, partner boolean, coupon_text text, match text, my_code text,
  food_id bigint, walk_minutes integer, open_now boolean, team_count integer, photo_url text,
  council_college text, council_text text, total_count integer, menu_name text, menu_cuisine text)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_session public.sessions;
  v_area text;
  v_done boolean;
  v_college text := public.my_prefs() ->> 'college';
  v_menu public.foods;
begin
  select * into v_session from public.sessions s where s.id = p_session_id;
  if not found or not public.is_session_member(p_session_id) then
    raise exception 'not_member';
  end if;
  v_done := v_session.status = 'done';
  select g.area into v_area from public.groups g where g.id = v_session.group_id;
  if v_done then
    select * into v_menu from public.foods f where f.id = v_session.decided_food_id;
  end if;

  return query
  with base as (
    -- 기준 음식: 끝난 판은 결정된 음식 하나, 아니면 후보 전부(먼저 올라온 순)
    select f.id as food_id, f.name as food_name, f.cuisine as food_cuisine, 0::bigint as ord
    from public.foods f
    where v_done and f.id = v_session.decided_food_id
    union all
    select f.id, f.name, f.cuisine, row_number() over (order by c.created_at, c.food_id)
    from public.candidates c
    join public.foods f on f.id = c.food_id
    where not v_done and c.session_id = p_session_id
  ),
  picked as (
    select r.id, r.area, r.name, r.cuisine, r.partner, r.coupon_text, r.lat, r.lng, r.opening_hours, r.photo_url,
      public.shop_has_offer(r.partner, r.coupon_text) as offer,
      (select b.food_id from base b
       where strpos(r.name, b.food_name) > 0 or b.food_name = any (r.menus)
       order by b.ord limit 1) as menu_food_id,
      cp.college as council_college, cp.benefit as council_text,
      (select power(r.lat - coalesce(max(g.lat), 37.2998), 2) + power((r.lng - coalesce(max(g.lng), 126.8369)) * 0.794, 2)
       from public.area_gate(r.area) g) as dist
    from public.restaurants r
    left join lateral public.my_council_pick(r.id, v_college) cp on true
    where r.area = v_area
      and exists (
        select 1 from base b
        where strpos(r.name, b.food_name) > 0 or b.food_name = any (r.menus)
           or (b.food_cuisine is not null and r.cuisine = b.food_cuisine)
      )
  )
  select p.id, p.name, p.cuisine, p.offer,
    case when p.offer then p.coupon_text end,
    case when p.menu_food_id is not null then 'menu' else 'cuisine' end,
    (select c.code from public.coupon_claims c
     where c.session_id = p_session_id and c.restaurant_id = p.id and c.user_id = v_uid),
    p.menu_food_id,
    public.walk_minutes(p.area, p.lat, p.lng),
    public.is_open_now(p.opening_hours),
    (select count(distinct c.session_id)::int from public.coupon_claims c where c.restaurant_id = p.id),
    case when p.partner then p.photo_url end,
    p.council_college, p.council_text,
    (count(*) over ())::int,
    v_menu.name, v_menu.cuisine
  from picked p
  order by
    p.offer desc,
    (p.council_college is not null) desc,
    -- 같은 칸 안에서는 이름이나 대표 메뉴에 그 음식이 있는 곳이 먼저, 그다음 가까운 순
    (p.menu_food_id is not null) desc,
    p.dist nulls last,
    p.id
  limit case when v_done then 3 else 6 end;
end;
$$;

revoke execute on function public.council_first_line(text), public.my_council_pick(bigint, text),
  public.session_cafes(uuid), public.session_restaurants(uuid) from public, anon;
revoke execute on function public.council_first_line(text), public.my_council_pick(bigint, text) from authenticated;
grant execute on function public.session_cafes(uuid), public.session_restaurants(uuid) to authenticated;
