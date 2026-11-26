-- 사용 기록 숫자 보기(보고서, 발표에 쓰는 실측). 팀만 Supabase 대시보드 SQL Editor에서 쓴다.
-- 빼는 것: 'zz'로 시작하는 동네의 모임(시험, 예시), demo_seed로 표시한 모임(시연 자료, 명세 4-32), 가상 인물이 들어간 기록.
-- 기간은 맨 위 두 날짜만 바꾼다(한국 날짜, 끝 날짜 포함).

with params as (
  select date '2026-11-01' as d_from, date '2026-12-31' as d_to
),
real_groups as (
  select g.id from public.groups g
  where g.area not like 'zz%' and not public.is_demo_group(g.id)
),
s as (
  select x.* from public.sessions x
  join real_groups rg on rg.id = x.group_id
  cross join params p
  where (x.created_at at time zone 'Asia/Seoul')::date between p.d_from and p.d_to
),
m as (
  select x.* from public.meals x
  join real_groups rg on rg.id = x.group_id
  cross join params p
  where (x.eaten_at at time zone 'Asia/Seoul')::date between p.d_from and p.d_to
),
people as (
  select distinct sp.user_id from public.session_participants sp
  join s on s.id = sp.session_id
  where not public.is_demo_user(sp.user_id)
)
select (select count(distinct s.group_id) from s) as 판을_연_모임,
  (select count(*) from s) as 연_판,
  (select count(*) from s where s.status = 'done') as 끝난_판,
  (select count(*) from m) as 식사_기록,
  (select count(*) from people) as 판에_들어온_사람,
  (select round(avg(n), 1) from (select count(*) as n from public.meal_participants mp join m on m.id = mp.meal_id group by mp.meal_id) k) as 끼니당_인원;
