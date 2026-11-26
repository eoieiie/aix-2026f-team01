-- 시연 자료 표시와 실측 숫자에서 빼기 (2026-11-26, 명세 4-32)
-- 발표 화면과 같은 예시 자료(모임 "점심 메이트"와 식사 기록)를 팀장 계정에 넣을 때 무엇을 넣었는지 demo_seed에 한 줄씩 남긴다.
--   kind 'seed': 넣은 행. scripts/demo-seed-remove.sql이 이것만 지운다.
--   kind 'mark': 원래 있던 행에 표시만 한 것(시연용 가상 인물 민준, 서연, 지호와 그 모임, 예시 가게). 지우지 않는다.
-- 표시된 모임의 판에서 받은 쿠폰과 가상 인물의 쿠폰은 가게의 "밥BTI로 간 모임", 사장님과 운영자 현황판, 단과대별 합계에서 뺀다.
-- 표시된 예시 가게(한양 분식 (예시), 동네 zz_test)는 표시된 모임 구성원에게만 가게 목록과 그 모임의 판 결과에 나온다.
-- 다른 사용자, 애플 심사 계정, 사장님 화면은 그대로다. 여러 번 돌려도 같다.

create table if not exists public.demo_seed (
  id bigserial primary key,
  table_name text not null,
  row_id text not null,
  kind text not null default 'seed' check (kind in ('seed', 'mark')),
  note text,
  created_at timestamptz not null default now(),
  unique (table_name, row_id)
);
alter table public.demo_seed enable row level security;
revoke all on table public.demo_seed from anon, authenticated;
revoke all on sequence public.demo_seed_id_seq from anon, authenticated;

create or replace function public.is_demo_group(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.demo_seed d where d.table_name = 'groups' and d.row_id = p_group_id::text);
$$;

create or replace function public.is_demo_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.demo_seed d where d.table_name = 'profiles' and d.kind = 'mark' and d.row_id = p_user_id::text);
$$;

create or replace function public.demo_shop_ids()
returns setof bigint
language sql
stable
security definer
set search_path = ''
as $$
  select d.row_id::bigint from public.demo_seed d where d.table_name = 'restaurants';
$$;

-- 표시된 모임에 들어 있는 사람(초대 링크로 들어온 사람 포함)
create or replace function public.is_demo_viewer(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    join public.demo_seed d on d.table_name = 'groups' and d.row_id = m.group_id::text
    where m.user_id = p_uid
  );
$$;

-- 시연 자료로 받은 쿠폰: 표시된 모임의 판에서 받았거나, 가상 인물이 받은 것
create or replace function public.is_demo_claim(p_session_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_demo_user(p_user_id)
    or exists (select 1 from public.sessions s where s.id = p_session_id and public.is_demo_group(s.group_id));
$$;

revoke execute on function public.is_demo_group(uuid), public.is_demo_user(uuid), public.demo_shop_ids(),
  public.is_demo_viewer(uuid), public.is_demo_claim(uuid, uuid) from public, anon, authenticated;

create or replace function public.shop_list()
 RETURNS TABLE(id bigint, name text, cuisine text, partner boolean, coupon_text text, walk_minutes integer, open_now boolean, photo_path text, thumb_food_id bigint, thumb_image text, lat double precision, lng double precision, menus text[], menus_guess text[])
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
     or (r.id in (select public.demo_shop_ids()) and public.is_demo_viewer(v_uid))
  order by o.offer desc, w.minutes nulls last, r.name, r.id;
end;
$function$;

create or replace function public.shop_detail(p_restaurant_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  r public.restaurants;
  v_food bigint;
  v_visits int;
  v_offer boolean;
begin
  perform public.require_uid();
  select * into r from public.restaurants x where x.id = p_restaurant_id;
  if not found then
    raise exception 'not_found';
  end if;
  v_food := public.shop_thumb_food(r.name, r.menus, r.cuisine);
  v_offer := public.shop_has_offer(r.partner, r.coupon_text);
  select count(distinct coalesce(c.session_id::text, c.id::text))::int into v_visits
  from public.coupon_claims c
  where c.restaurant_id = r.id and c.redeemed_at is not null
    and (r.area like 'zz%' or not public.is_demo_claim(c.session_id, c.user_id));

  return jsonb_build_object(
    'id', r.id,
    'name', r.name,
    'cuisine', r.cuisine,
    'partner', v_offer,
    'coupon_text', case when v_offer then r.coupon_text end,
    'address', r.address,
    'phone', r.phone,
    'opening_hours', r.opening_hours,
    'licensed_year', extract(year from r.licensed_on)::int,
    'menus', to_jsonb(r.menus),
    'walk_minutes', public.walk_minutes(r.area, r.lat, r.lng),
    'open_now', public.is_open_now(r.opening_hours),
    'lat', r.lat,
    'lng', r.lng,
    'photos', coalesce(
      (select jsonb_agg(jsonb_build_object('path', p.path, 'credit', p.credit) order by p.sort, p.id)
       from public.shop_photos p where p.restaurant_id = r.id),
      '[]'::jsonb),
    'thumb_food_id', v_food,
    'thumb_image', coalesce(
      (select f.image_path from public.foods f where f.id = v_food),
      case when r.cuisine = 'cafe' then public.shop_cafe_image(r.name) end),
    'visits', case when v_visits >= 5 then v_visits end
  );
end;
$function$;

create or replace function public.session_restaurants(p_session_id uuid)
 RETURNS TABLE(id bigint, name text, cuisine text, partner boolean, coupon_text text, match text, my_code text, food_id bigint, walk_minutes integer, open_now boolean, team_count integer, photo_url text, council_college text, council_text text, total_count integer, menu_name text, menu_cuisine text, tier integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
       or (public.is_demo_group(v_session.group_id) and r.id in (select public.demo_shop_ids()))
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
    (select count(distinct c.session_id)::int from public.coupon_claims c
     where c.restaurant_id = t.id and (t.area like 'zz%' or not public.is_demo_claim(c.session_id, c.user_id))),
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
$function$;

create or replace function public.claim_coupon(p_session_id uuid, p_restaurant_id bigint)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := public.require_uid();
  v_session public.sessions;
  v_shop public.restaurants;
  v_code text;
  v_people int;
begin
  select * into v_session from public.sessions s where s.id = p_session_id;
  if not found or not public.is_session_member(p_session_id) then
    raise exception 'not_member';
  end if;
  if v_session.status <> 'done' then
    raise exception 'not_done';
  end if;
  select r.* into v_shop
  from public.restaurants r
  join public.groups g on g.id = v_session.group_id
    and (g.area = r.area or (public.is_demo_group(g.id) and r.id in (select public.demo_shop_ids())))
  where r.id = p_restaurant_id and r.partner;
  if not found then
    raise exception 'not_partner';
  end if;
  select greatest(1, least(50, count(*)))::int into v_people
  from public.session_participants sp where sp.session_id = p_session_id;
  v_code := public.coupon_code(p_session_id, p_restaurant_id);
  insert into public.coupon_claims (restaurant_id, session_id, user_id, code, source, claim_day, benefit, party_size)
  values (p_restaurant_id, p_session_id, v_uid, v_code, 'session',
    (now() at time zone 'Asia/Seoul')::date, v_shop.coupon_text, v_people)
  on conflict (session_id, restaurant_id, user_id) do nothing;
  return v_code;
end;
$function$;

create or replace function public.admin_coupon_board(p_days integer DEFAULT 30, p_area text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_since timestamptz := now() - make_interval(days => greatest(1, least(365, coalesce(p_days, 30))));
  v_out jsonb;
begin
  perform public.require_uid();
  if not public.is_app_admin() then
    raise exception 'not_admin';
  end if;

  with shops as (
    select r.id, r.name, r.partner, r.coupon_text
    from public.restaurants r
    where case when p_area is null then r.area not like 'zz%' else r.area = p_area end
  ),
  tickets as (
    select c.restaurant_id,
      coalesce(c.session_id::text, c.id::text) as ticket,
      c.session_id,
      min(c.source) as source,
      min(c.claimed_at) as claimed_at,
      max(c.redeemed_at) as redeemed_at,
      max(c.party_size) as people,
      array_agg(c.user_id) as users
    from public.coupon_claims c
    join shops s on s.id = c.restaurant_id
    where c.claimed_at >= v_since
      and (p_area is not null or not public.is_demo_claim(c.session_id, c.user_id))
    group by c.restaurant_id, coalesce(c.session_id::text, c.id::text), c.session_id
  ),
  local as (
    select t.*,
      extract(isodow from t.claimed_at at time zone 'Asia/Seoul')::int as c_dow,
      extract(hour from t.claimed_at at time zone 'Asia/Seoul')::int as c_hour,
      extract(isodow from t.redeemed_at at time zone 'Asia/Seoul')::int as r_dow,
      extract(hour from t.redeemed_at at time zone 'Asia/Seoul')::int as r_hour
    from tickets t
  )
  select jsonb_build_object(
    'days', greatest(1, least(365, coalesce(p_days, 30))),
    'area', p_area,
    'totals', (select jsonb_build_object(
        'claimed', count(*),
        'redeemed', count(l.redeemed_at),
        'people', coalesce(sum(l.people) filter (where l.redeemed_at is not null), 0),
        'shops', count(distinct l.restaurant_id)
      ) from local l),
    'shops', coalesce((select jsonb_agg(x order by x.redeemed desc, x.claimed desc, x.name) from (
        select s.id, s.name,
          count(l.ticket)::int as claimed,
          count(l.redeemed_at)::int as redeemed,
          coalesce(sum(l.people) filter (where l.redeemed_at is not null), 0)::int as people,
          max(l.redeemed_at) as last_redeemed_at
        from shops s
        left join local l on l.restaurant_id = s.id
        where (s.partner and s.coupon_text is not null) or l.ticket is not null
        group by s.id, s.name
      ) x), '[]'::jsonb),
    'recent', coalesce((select jsonb_agg(y order by y.claimed_at desc) from (
        select coalesce((select string_agg(p.display_name, ', ' order by p.display_name)
                         from public.profiles p where p.user_id = any (l.users)), '이름 없음') as names,
          s.name as shop,
          (select f.name from public.sessions ss join public.foods f on f.id = ss.decided_food_id
           where ss.id = l.session_id) as menu,
          l.people, l.claimed_at, l.redeemed_at, l.source
        from local l
        join shops s on s.id = l.restaurant_id
        order by l.claimed_at desc
        limit 50
      ) y), '[]'::jsonb),
    'dow_claimed', (select jsonb_agg((select count(*) from local l where l.c_dow = d) order by d) from generate_series(1, 7) d),
    'dow_redeemed', (select jsonb_agg((select count(*) from local l where l.r_dow = d) order by d) from generate_series(1, 7) d),
    'hour_claimed', (select jsonb_agg((select count(*) from local l where l.c_hour = h) order by h) from generate_series(0, 23) h),
    'hour_redeemed', (select jsonb_agg((select count(*) from local l where l.r_hour = h) order by h) from generate_series(0, 23) h)
  ) into v_out;
  return v_out;
end;
$function$;

create or replace function public.admin_coupon_colleges(p_days integer DEFAULT 30, p_area text DEFAULT NULL::text)
 RETURNS TABLE(college text, users integer, redeemed integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_since timestamptz := now() - make_interval(days => greatest(1, least(365, coalesce(p_days, 30))));
  v_min int := public.coupon_rule('SHOP_STATS_MIN');
begin
  perform public.require_uid();
  if not public.is_app_admin() then
    raise exception 'not_admin';
  end if;
  return query
  with used as (
    select c.user_id, count(*)::int as n
    from public.coupon_claims c
    join public.restaurants r on r.id = c.restaurant_id
      and case when p_area is null then r.area not like 'zz%' else r.area = p_area end
    where c.claimed_at >= v_since and c.redeemed_at is not null
      and (p_area is not null or not public.is_demo_claim(c.session_id, c.user_id))
    group by c.user_id
  ),
  by_college as (
    select coalesce(p.college, 'none') as k, count(*)::int as u, sum(u0.n)::int as n
    from used u0 left join public.profiles p on p.user_id = u0.user_id
    group by coalesce(p.college, 'none')
  ),
  grouped as (
    select case when b.k <> 'none' and b.u >= v_min then b.k else 'other' end as k, b.u, b.n
    from by_college b
  )
  select g.k, sum(g.u)::int, sum(g.n)::int
  from grouped g
  group by g.k
  order by (g.k = 'other'), sum(g.n) desc, g.k;
end;
$function$;

create or replace function public.owner_board(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_shop public.restaurants;
  v_pin boolean;
  v_week timestamptz := date_trunc('week', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
  v_min int := public.coupon_rule('SHOP_STATS_MIN');
  v_out jsonb;
begin
  if p_token is null or char_length(p_token) < 32 then
    raise exception 'not_found';
  end if;
  select r.* into v_shop
  from public.shop_private s
  join public.restaurants r on r.id = s.restaurant_id
  where s.owner_token = p_token;
  if not found then
    raise exception 'not_found';
  end if;
  select (s.staff_pin is not null) into v_pin from public.shop_private s where s.restaurant_id = v_shop.id;

  with tickets as (
    select coalesce(c.session_id::text, c.id::text) as ticket,
      c.session_id,
      min(c.claimed_at) as claimed_at,
      max(c.redeemed_at) as redeemed_at,
      max(c.party_size) as people
    from public.coupon_claims c
    where c.restaurant_id = v_shop.id
      and (v_shop.area like 'zz%' or not public.is_demo_claim(c.session_id, c.user_id))
    group by coalesce(c.session_id::text, c.id::text), c.session_id
  ),
  total as (select count(*)::int as n from tickets)
  select jsonb_build_object(
    'shop', jsonb_build_object('name', v_shop.name, 'benefit', v_shop.coupon_text, 'partner', v_shop.partner, 'pin_set', v_pin),
    'week', (select jsonb_build_object(
        'claimed', count(*),
        'redeemed', count(t.redeemed_at),
        'people', coalesce(sum(t.people) filter (where t.redeemed_at is not null), 0)
      ) from tickets t where t.claimed_at >= v_week),
    'total', (select jsonb_build_object(
        'claimed', count(*),
        'redeemed', count(t.redeemed_at),
        'people', coalesce(sum(t.people) filter (where t.redeemed_at is not null), 0)
      ) from tickets t),
    'min_teams', v_min,
    'hour_claimed', case when (select n from total) >= v_min then
      (select jsonb_agg((select count(*) from tickets t
                         where extract(hour from t.claimed_at at time zone 'Asia/Seoul')::int = h) order by h)
       from generate_series(0, 23) h) end,
    'hour_redeemed', case when (select n from total) >= v_min then
      (select jsonb_agg((select count(*) from tickets t
                         where extract(hour from t.redeemed_at at time zone 'Asia/Seoul')::int = h) order by h)
       from generate_series(0, 23) h) end,
    'menus', case when (select n from total) >= v_min then
      coalesce((select jsonb_agg(jsonb_build_object('name', m.name, 'teams', m.teams) order by m.teams desc, m.name) from (
        select f.name, count(*)::int as teams
        from tickets t
        join public.sessions ss on ss.id = t.session_id
        join public.foods f on f.id = ss.decided_food_id
        group by f.name
        order by count(*) desc, f.name
        limit 5
      ) m), '[]'::jsonb) end
  ) into v_out;
  return v_out;
end;
$function$;

grant execute on function public.shop_list(), public.shop_detail(bigint), public.session_restaurants(uuid),
  public.claim_coupon(uuid, bigint), public.admin_coupon_board(integer, text), public.admin_coupon_colleges(integer, text)
  to authenticated;
grant execute on function public.owner_board(text) to anon, authenticated;
