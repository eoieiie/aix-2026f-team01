-- 0034 쿠폰 현황판: 운영자와 사장님 (명세 4-28, 2026-11-25)
-- 병주: "한눈에 누가 쿠폰 쓰고 했는지 알려줘"
-- (1) 운영자(팀): app_admins에 든 계정만 admin_coupon_board를 부를 수 있다. 이름이 보인다.
-- (2) 사장님: owner_board(토큰). 로그인이 없고 긴 토큰 주소로 연다. 그 가게 것만, 이름 없이.
--     팀 수가 5보다 적으면 숫자만 주고 시간대와 메뉴 분포는 주지 않는다(누가 왔는지 짐작할 수 없게).
-- 세는 단위는 "팀"이다. 판에서 받은 쿠폰은 판 하나가 한 팀(여러 사람이 받아도 한 팀), 가게 화면에서 받은 쿠폰은 한 장이 한 팀.
-- 여러 번 돌려도 같은 결과가 되게 썼다.

create table if not exists public.app_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;
revoke all on public.app_admins from anon, authenticated;

create or replace function public.is_app_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.app_admins a where a.user_id = auth.uid())
$$;

-- 운영자 현황판. p_days: 최근 며칠(1~365). p_area: 동네. 비우면 실제 동네 전부('zz'로 시작하는 시험·예시 동네는 뺀다)
create or replace function public.admin_coupon_board(p_days int default 30, p_area text default null) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
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
$$;

-- 사장님 현황. 토큰이 맞는 가게 하나만. 이름과 아이디는 나가지 않는다.
-- 이번 주는 한국 시간 월요일 0시부터. 분포(시간대, 메뉴)는 누적 팀이 SHOP_STATS_MIN(5) 이상일 때만
create or replace function public.owner_board(p_token text) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
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
$$;

revoke execute on function public.is_app_admin(), public.admin_coupon_board(int, text), public.owner_board(text)
  from public, anon;
grant execute on function public.is_app_admin(), public.admin_coupon_board(int, text) to authenticated;
-- 사장님 주소는 로그인 없이 연다. 토큰(32자 이상)을 아는 사람만 그 가게 숫자를 본다
grant execute on function public.owner_board(text) to anon, authenticated;
