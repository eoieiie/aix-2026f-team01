-- 결과 뒤 "이 메뉴 파는 학교 앞"과 투표 화면 추천 칸의 순서를 메뉴 먼저로 고친다 (명세 4-21, 2026-11-25 병주 리뷰).
-- 묶음: (1) 가게 이름이나 대표 메뉴에 그 메뉴가 있는 가게 (2) 같은 종류의 일반 가게
-- (3) 같은 종류지만 이름에 다른 음식 이름이 든 전문점(훠궈, 마라탕, 샤브샤브처럼). 각 묶음 안에서 쿠폰 가게, 내 학생회 제휴, 가까운 순.
-- 대표 메뉴 상당수는 업태로 채운 것이라(0017, 중국식 → 짜장면 짬뽕 탕수육) 전문점 이름과 어긋날 수 있다.
-- 그래서 이름에 다른 음식이 있고 그 음식이 대표 메뉴에도 없으면 대표 메뉴로는 (1)에 넣지 않는다(이름에 그 메뉴가 있으면 (1)).
-- 예: 짜장면 판에서 대홍훠궈샤브샤브(대표 메뉴는 업태로 채운 짜장면 짬뽕 탕수육)는 (3), 보배반점은 (1), 도야짬뽕은 (3)
-- 학생회 혜택은 원문 그대로 주고, 한 줄로 잇는 일은 화면의 benefitLine이 가게 탭과 같게 한다.
-- 여러 번 돌려도 같다.

-- 가게 이름에서 찾는 음식 낱말: 기본 음식 이름(두 글자 이상) + foods 표에 없는 전문점 낱말
create or replace function public.shop_specialty_words()
returns text[]
language sql stable set search_path = ''
as $$
  select array(
    select f.name from public.foods f where not f.custom and char_length(f.name) >= 2
    union
    select w from unnest(array['훠궈', '샤브샤브', '마라', '족발', '보쌈', '양꼬치']) as w
  )
$$;

-- 가게 이름에 기준 음식(p_bases)이 아닌 다른 음식 낱말이 있는가(기준 음식 이름과 겹치는 낱말은 뺀다).
-- p_menus가 null이면 이름만 본다(전문점 판정). p_menus를 주면 대표 메뉴에도 없는 낱말만 센다
-- (참이면 업태로 채운 대표 메뉴를 믿지 않는다)
create or replace function public.shop_is_specialty(p_name text, p_menus text[], p_bases text[])
returns boolean
language sql stable set search_path = ''
as $$
  select exists (
    select 1 from unnest(public.shop_specialty_words()) as w
    where strpos(coalesce(p_name, ''), w) > 0
      and not exists (select 1 from unnest(p_bases) as b where strpos(b, w) > 0 or strpos(w, b) > 0)
      and (p_menus is null or not (w = any (p_menus)))
  )
$$;

-- 학생회 제휴 하나: 내 단과대가 총학생회보다, 혜택 문구가 있는 것이 먼저. 혜택은 원문 그대로(0048은 첫 줄)
create or replace function public.my_council_pick(p_restaurant_id bigint, p_college text)
returns table (college text, benefit text)
language sql stable set search_path = ''
as $$
  select b.college, nullif(btrim(b.benefit), '')
  from public.council_benefits b
  where b.show_in_app and b.restaurant_id = p_restaurant_id
    and (b.college = 'all' or (p_college is not null and b.college = p_college))
  order by (b.college = 'all'), (nullif(btrim(b.benefit), '') is null), b.id
  limit 1
$$;

drop function if exists public.session_restaurants(uuid);
create function public.session_restaurants(p_session_id uuid)
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
      public.shop_is_specialty(r.name, coalesce(r.menus, '{}'), n.all_names) as menu_doubt
    from public.restaurants r cross join names n
    where r.area = v_area
  ),
  picked as (
    select s.id, s.area, s.name, s.cuisine, s.partner, s.coupon_text, s.lat, s.lng, s.opening_hours, s.photo_url, s.specialty,
      public.shop_has_offer(s.partner, s.coupon_text) as offer,
      (select b.food_id from base b
       where strpos(s.name, b.food_name) > 0 or (not s.menu_doubt and b.food_name = any (s.menus))
       order by b.ord limit 1) as menu_food_id,
      cp.college as council_college, cp.benefit as council_text,
      -- 정문에서 가까운 순(평면 근사). 정문을 모르는 동네는 ERICA 정문, 좌표가 없으면 맨 뒤
      (select power(s.lat - coalesce(max(g.lat), 37.2998), 2) + power((s.lng - coalesce(max(g.lng), 126.8369)) * 0.794, 2)
       from public.area_gate(s.area) g) as dist
    from shops s
    left join lateral public.my_council_pick(s.id, v_college) cp on true
    where exists (
        select 1 from base b
        where strpos(s.name, b.food_name) > 0 or b.food_name = any (s.menus)
           or (b.food_cuisine is not null and s.cuisine = b.food_cuisine)
      )
  ),
  tiered as (
    select p.*, case when p.menu_food_id is not null then 1 when not p.specialty then 2 else 3 end as tier_no
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

revoke execute on function public.shop_specialty_words(), public.shop_is_specialty(text, text[], text[]),
  public.my_council_pick(bigint, text), public.session_restaurants(uuid) from public, anon, authenticated;
grant execute on function public.session_restaurants(uuid) to authenticated;
