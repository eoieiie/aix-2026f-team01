-- 0035 운영자 현황판의 단과대별 쓴 쿠폰 (명세 4-28, 2026-11-25)
-- profiles.college(0036, 선택 항목)로 가게에서 쓴 쿠폰을 단과대별 합계로만 센다. 운영자(app_admins)만 부른다.
-- 사람이 5명 미만인 단과대(고르지 않은 사람 포함)는 'other'(기타)로 묶는다. 사장님 화면(owner_board)에는 넣지 않는다.
-- 사람 단위: 쿠폰을 받은 사람. 판에서 받은 쿠폰은 한 사람이 확인하면 같은 판 쿠폰이 모두 쓴 것이 되므로 그 판 사람이 모두 센다.
-- 새 데이터베이스에서는 0035가 0036보다 먼저 돌아서 college 칸을 먼저 만든다(0036도 if not exists라 겹치지 않는다). 여러 번 돌려도 같다.

alter table public.profiles add column if not exists college text;

create or replace function public.admin_coupon_colleges(p_days int default 30, p_area text default null)
returns table (college text, users int, redeemed int)
language plpgsql stable security definer set search_path = ''
as $$
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
$$;

revoke execute on function public.admin_coupon_colleges(int, text) from public, anon;
grant execute on function public.admin_coupon_colleges(int, text) to authenticated;
