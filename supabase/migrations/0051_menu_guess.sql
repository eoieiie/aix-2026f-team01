-- 업태로 짐작한 대표 메뉴를 사실처럼 보이지 않는다 (명세 4-21, 4-26, 2026-11-25 병주 리뷰).
-- 0017과 python/01_preprocess_shops.py의 guess_menus가 업태로 흔한 메뉴(중국식 짜장면 짬뽕 탕수육, 분식 떡볶이 김밥 라면,
-- 호프/통닭 치킨, 냉면집 물냉면, 오픈스트리트맵 italian 피자 등)를 menus에 넣었고, 가게 상세 "대표 메뉴"와 가게 그림이 이것을 썼다.
-- 예: 대홍훠궈샤브샤브(중국식)에 짜장면 짬뽕 탕수육.
-- 1. menus_guess 칸을 더하고, menus에서 가게 이름(별칭 포함)에 근거가 없는 메뉴를 menus_guess로 옮긴다.
--    짐작 메뉴의 음식 종류가 가게의 지금 종류와 다르면 버린다(종류를 고친 가게에 남은 짐작).
-- 2. 가게 상세의 대표 메뉴와 가게 그림(shop_thumb_food)은 menus만 쓴다(함수는 그대로, 칸만 바뀐다).
-- 3. 가게 탭 찾기는 menus와 menus_guess를 둘 다 본다(shop_list가 menus_guess를 준다).
-- 4. 결과 순서의 (1) 메뉴 일치는 menus만, 짐작만 맞으면 (2) 일반 가게.
-- 예시 동네(zz_test)의 발표용 가게는 건드리지 않는다. 여러 번 돌려도 같다.

alter table public.restaurants add column if not exists menus_guess text[] not null default '{}';

-- 가게 이름에 이 메뉴의 근거가 있는가: 음식 이름이 그대로 있거나(띄어쓰기 무시), 별칭 낱말이 있다.
-- 별칭은 python/01_preprocess_shops.py MENU_ALIASES와 0040에서 이름으로 채운 것(핏짜, 부찌, 삼겹, 제육)
create or replace function public.shop_menu_evidence(p_name text, p_menu text)
returns boolean
language sql immutable set search_path = ''
as $$
  select strpos(replace(coalesce(p_name, ''), ' ', ''), replace(coalesce(p_menu, ''), ' ', '')) > 0
    or exists (
      select 1 from (values
        ('스시', '초밥'), ('버거', '햄버거'), ('파스타', '토마토 파스타'), ('마라', '마라탕'), ('국밥', '돼지국밥'),
        ('핏짜', '피자'), ('부찌', '부대찌개'), ('삼겹', '삼겹살'), ('제육', '제육볶음')
      ) as a (word, food)
      where a.food = p_menu and strpos(coalesce(p_name, ''), a.word) > 0
    )
$$;

-- 메뉴 나누기: menus(이름에 근거), guess(업태 짐작, 가게 종류와 같은 음식만), dropped(종류가 다른 짐작)
create or replace function public.shop_split_menus(p_name text, p_cuisine text, p_menus text[])
returns table (menus text[], guess text[], dropped text[])
language sql stable set search_path = ''
as $$
  with m as (
    select u.menu, u.ord, public.shop_menu_evidence(p_name, u.menu) as sure,
      (select f.cuisine from public.foods f where f.name = u.menu and not f.custom order by f.id limit 1) as food_cuisine
    from unnest(coalesce(p_menus, '{}')) with ordinality as u (menu, ord)
  )
  select
    coalesce(array(select m.menu from m where m.sure order by m.ord), '{}'),
    coalesce(array(select m.menu from m where not m.sure and (m.food_cuisine is null or m.food_cuisine = p_cuisine) order by m.ord), '{}'),
    coalesce(array(select m.menu from m where not m.sure and m.food_cuisine is not null and m.food_cuisine <> p_cuisine order by m.ord), '{}')
$$;

update public.restaurants r
set menus = s.menus,
  menus_guess = r.menus_guess || array(select g from unnest(s.guess) as g where not (g = any (r.menus_guess)))
from public.restaurants x
cross join lateral public.shop_split_menus(x.name, x.cuisine, x.menus) s
where x.id = r.id and r.area <> 'zz_test' and cardinality(s.menus) < cardinality(coalesce(r.menus, '{}'));

-- 가게 목록. 0040과 같고 찾기용 menus_guess를 더 준다
drop function if exists public.shop_list();
create function public.shop_list()
returns table (
  id bigint, name text, cuisine text, partner boolean, coupon_text text,
  walk_minutes int, open_now boolean, photo_path text, thumb_food_id bigint, thumb_image text,
  lat double precision, lng double precision, menus text[], menus_guess text[]
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_area text;
begin
  select g.area into v_area
  from public.memberships m
  join public.groups g on g.id = m.group_id
  where m.user_id = v_uid
  order by m.joined_at desc
  limit 1;
  v_area := coalesce(v_area, 'erica');

  return query
  select r.id, r.name, r.cuisine, o.offer,
    case when o.offer then r.coupon_text end,
    w.minutes,
    public.is_open_now(r.opening_hours),
    (select p.path from public.shop_photos p where p.restaurant_id = r.id order by p.sort, p.id limit 1),
    t.food_id,
    coalesce(
      (select f.image_path from public.foods f where f.id = t.food_id),
      case when r.cuisine = 'cafe' then public.shop_cafe_image(r.name) end),
    r.lat, r.lng, r.menus, r.menus_guess
  from public.restaurants r
  cross join lateral (select public.shop_thumb_food(r.name, r.menus, r.cuisine) as food_id) t
  cross join lateral (select public.walk_minutes(r.area, r.lat, r.lng) as minutes) w
  cross join lateral (select public.shop_has_offer(r.partner, r.coupon_text) as offer) o
  where r.area = v_area
  order by o.offer desc, w.minutes nulls last, r.name, r.id;
end;
$$;

-- 이 메뉴 파는 학교 앞(0050에서 짐작 메뉴만 (2)로)
create or replace function public.session_restaurants(p_session_id uuid)
returns table (id bigint, name text, cuisine text, partner boolean, coupon_text text, match text, my_code text,
  food_id bigint, walk_minutes integer, open_now boolean, team_count integer, photo_url text,
  council_college text, council_text text, total_count integer, menu_name text, menu_cuisine text, tier integer)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_session public.sessions;
  v_area text;
  v_done boolean;
  v_college text := public.my_prefs() ->> 'college';
  v_menu public.foods;
  v_bases text[];
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
  names as (select array_agg(b.food_name) as all_names from base b),
  shops as (
    select r.*, public.shop_is_specialty(r.name, null, n.all_names) as specialty,
      public.shop_is_specialty(r.name, coalesce(r.menus, '{}') || coalesce(r.menus_guess, '{}'), n.all_names) as menu_doubt
    from public.restaurants r cross join names n
    where r.area = v_area
  ),
  picked as (
    select s.id, s.area, s.name, s.cuisine, s.partner, s.coupon_text, s.lat, s.lng, s.opening_hours, s.photo_url, s.specialty,
      public.shop_has_offer(s.partner, s.coupon_text) as offer,
      (select b.food_id from base b
       where strpos(s.name, b.food_name) > 0 or b.food_name = any (s.menus)
       order by b.ord limit 1) as menu_food_id,
      -- 업태로 짐작한 메뉴만 맞으면 (2) 일반 가게. 이름의 다른 음식이 메뉴에도 짐작에도 없으면(전문점) 짐작을 믿지 않는다
      (not s.menu_doubt and exists (select 1 from base b where b.food_name = any (s.menus_guess))) as guess_hit,
      cp.college as council_college, cp.benefit as council_text,
      -- 정문에서 가까운 순(평면 근사). 정문을 모르는 동네는 ERICA 정문, 좌표가 없으면 맨 뒤
      (select power(s.lat - coalesce(max(g.lat), 37.2998), 2) + power((s.lng - coalesce(max(g.lng), 126.8369)) * 0.794, 2)
       from public.area_gate(s.area) g) as dist
    from shops s
    left join lateral public.my_council_pick(s.id, v_college) cp on true
    where exists (
        select 1 from base b
        where strpos(s.name, b.food_name) > 0 or b.food_name = any (s.menus) or b.food_name = any (s.menus_guess)
           or (b.food_cuisine is not null and s.cuisine = b.food_cuisine)
      )
  ),
  tiered as (
    select p.*, case when p.menu_food_id is not null then 1 when p.guess_hit or not p.specialty then 2 else 3 end as tier_no
    from picked p
  )
  select t.id, t.name, t.cuisine, t.offer,
    case when t.offer then t.coupon_text end,
    case when t.tier_no = 1 then 'menu' else 'cuisine' end,
    (select c.code from public.coupon_claims c
     where c.session_id = p_session_id and c.restaurant_id = t.id and c.user_id = v_uid),
    t.menu_food_id,
    public.walk_minutes(t.area, t.lat, t.lng),
    public.is_open_now(t.opening_hours),
    (select count(distinct c.session_id)::int from public.coupon_claims c where c.restaurant_id = t.id),
    case when t.partner then t.photo_url end,
    t.council_college, t.council_text,
    (count(*) over ())::int,
    v_menu.name, v_menu.cuisine,
    t.tier_no
  from tiered t
  order by
    t.tier_no,
    t.offer desc,
    (t.council_college is not null) desc,
    t.dist nulls last,
    t.id
  limit case when v_done then 3 else 6 end;
end;
$$;


revoke execute on function public.shop_menu_evidence(text, text), public.shop_split_menus(text, text, text[]),
  public.shop_list(), public.session_restaurants(uuid) from public, anon, authenticated;
grant execute on function public.shop_list(), public.session_restaurants(uuid) to authenticated;
