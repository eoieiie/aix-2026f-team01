-- 쿠폰 숫자 보기 (명세 4-27, 4-28). 팀만 Supabase 대시보드 SQL Editor에서 쓴다.
-- 세는 단위 "팀": 판에서 받은 쿠폰은 판 하나가 한 팀(여러 명이 받아도 한 팀), 가게 화면에서 받은 쿠폰은 한 장이 한 팀.
-- 'zz'로 시작하는 동네(시험, 발표 예시 가게)와 시연 자료(demo_seed로 표시한 모임의 판, 가상 인물의 쿠폰, 명세 4-32)는 뺀다. 기간은 맨 위 두 날짜만 바꾼다(한국 날짜, 끝 날짜 포함).

with params as (
  select date '2026-11-01' as d_from, date '2026-12-31' as d_to
),
tickets as (
  select c.restaurant_id,
    coalesce(c.session_id::text, c.id::text) as ticket,
    min(c.source) as source,
    min(c.claimed_at) as claimed_at,
    max(c.redeemed_at) as redeemed_at,
    max(c.party_size) as people
  from public.coupon_claims c
  join public.restaurants r on r.id = c.restaurant_id and r.area not like 'zz%'
  cross join params p
  where (c.claimed_at at time zone 'Asia/Seoul')::date between p.d_from and p.d_to
    and not public.is_demo_claim(c.session_id, c.user_id)
  group by c.restaurant_id, coalesce(c.session_id::text, c.id::text)
)
-- 1. 기간 전체: 받은 팀, 쓴 팀, 사용률, 쓴 팀의 평균 인원
select count(*) as 받은_팀,
  count(redeemed_at) as 쓴_팀,
  round(100.0 * count(redeemed_at) / nullif(count(*), 0), 1) as 사용률_퍼센트,
  round(avg(people) filter (where redeemed_at is not null), 1) as 팀당_인원,
  count(*) filter (where source = 'session') as 판에서_받은_팀,
  count(*) filter (where source = 'shop') as 가게화면에서_받은_팀
from tickets;

-- 2. 가게별 (같은 기간). 위 with 절을 그대로 붙여 쓴다
-- select r.name, count(*) as 받은_팀, count(t.redeemed_at) as 쓴_팀,
--   round(100.0 * count(t.redeemed_at) / nullif(count(*), 0), 1) as 사용률_퍼센트,
--   coalesce(sum(t.people) filter (where t.redeemed_at is not null), 0) as 온_인원
-- from tickets t join public.restaurants r on r.id = t.restaurant_id
-- group by r.name order by 받은_팀 desc;

-- 3. 주별 (같은 기간). 위 with 절을 그대로 붙여 쓴다
-- select date_trunc('week', t.claimed_at at time zone 'Asia/Seoul')::date as 주_시작,
--   count(*) as 받은_팀, count(t.redeemed_at) as 쓴_팀
-- from tickets t group by 1 order by 1;
