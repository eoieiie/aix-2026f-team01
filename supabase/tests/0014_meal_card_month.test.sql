-- 결과 카드의 "이번 달 이 모임은 한식 N번"과 음식 이름 (명세 4-17, 0013)
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002');
insert into public.foods (name, tags, cuisine) values
  ('m_kor1', array[]::text[], 'korean'),
  ('m_kor2', array[]::text[], 'korean'),
  ('m_jp', array[]::text[], 'japanese'),
  ('m_none', array[]::text[], null);
insert into public.groups (id, name, invite_code, created_by) values
  ('10000000-0000-0000-0000-000000000001', '달 모임', 'TESTMN', '00000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002', '다른 모임', 'TESTMP', '00000000-0000-0000-0000-000000000002');
insert into public.memberships (group_id, user_id, display_name) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '하나'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', '둘');

-- 식사: 1(10/31 23:30 한국, 한식, 지난달) 2(11/1 00:30 한국, 한식) 3(11/2 일식) 4(11/3 한식) 5(11/4 한식) 6(11/5 종류 없음) 7(다른 모임 11/3 한식)
insert into public.sessions (id, group_id, host_user_id, status)
select ('20000000-0000-0000-0000-00000000000' || n)::uuid, g::uuid, '00000000-0000-0000-0000-000000000001', 'done'
from (values
  (1, '10000000-0000-0000-0000-000000000001'), (2, '10000000-0000-0000-0000-000000000001'),
  (3, '10000000-0000-0000-0000-000000000001'), (4, '10000000-0000-0000-0000-000000000001'),
  (5, '10000000-0000-0000-0000-000000000001'), (6, '10000000-0000-0000-0000-000000000001'),
  (7, '10000000-0000-0000-0000-000000000002')
) as v (n, g);
insert into public.meals (id, group_id, session_id, food_id, eaten_at)
select ('30000000-0000-0000-0000-00000000000' || n)::uuid, g::uuid,
  ('20000000-0000-0000-0000-00000000000' || n)::uuid, (select id from public.foods where name = f), t::timestamptz
from (values
  (1, '10000000-0000-0000-0000-000000000001', 'm_kor1', '2026-10-31 23:30+09'),
  (2, '10000000-0000-0000-0000-000000000001', 'm_kor2', '2026-11-01 00:30+09'),
  (3, '10000000-0000-0000-0000-000000000001', 'm_jp', '2026-11-02 12:00+09'),
  (4, '10000000-0000-0000-0000-000000000001', 'm_kor1', '2026-11-03 12:00+09'),
  (5, '10000000-0000-0000-0000-000000000001', 'm_kor2', '2026-11-04 12:00+09'),
  (6, '10000000-0000-0000-0000-000000000001', 'm_none', '2026-11-05 12:00+09'),
  (7, '10000000-0000-0000-0000-000000000002', 'm_kor1', '2026-11-03 12:00+09')
) as v (n, g, f, t);
insert into public.meal_participants (meal_id, user_id)
select ('30000000-0000-0000-0000-00000000000' || n)::uuid, '00000000-0000-0000-0000-000000000001'::uuid
from generate_series(1, 6) as n;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select is(public.meal_card('30000000-0000-0000-0000-000000000004') -> 'group_month_cuisine',
  '{"cuisine": "korean", "count": 2}'::jsonb,
  '한국 시간 11월의 한식만, 이 식사까지 센다 (10/31 밤과 일식, 다른 모임은 빼고)');
select is((public.meal_card('30000000-0000-0000-0000-000000000005') -> 'group_month_cuisine' ->> 'count')::int, 3,
  '다른 한식 음식도 같은 종류로 센다');
select is((public.meal_card('30000000-0000-0000-0000-000000000001') -> 'group_month_cuisine' ->> 'count')::int, 1,
  '한국 시간 10/31 23:30 식사는 10월로 센다');
select is((public.meal_card('30000000-0000-0000-0000-000000000003') -> 'group_month_cuisine'),
  '{"cuisine": "japanese", "count": 1}'::jsonb, '일식은 일식끼리');
select ok((public.meal_card('30000000-0000-0000-0000-000000000006') -> 'group_month_cuisine') = 'null'::jsonb,
  '음식 종류가 없으면 null');
select is(public.meal_card('30000000-0000-0000-0000-000000000004') ->> 'food_name', 'm_kor1', '음식 이름');
reset role;

select * from finish();
rollback;
