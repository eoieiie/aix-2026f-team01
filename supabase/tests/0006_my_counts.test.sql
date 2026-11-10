-- 내 기록(4-15): 음식별 횟수와 같이 먹은 사람. 내가 없던 식사는 세지 않는다.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000003'),
  ('00000000-0000-0000-0000-000000000004'),
  ('00000000-0000-0000-0000-000000000005');  -- 식사 없음
insert into public.profiles (user_id, display_name) values
  ('00000000-0000-0000-0000-000000000001', '하나'),
  ('00000000-0000-0000-0000-000000000002', '둘'),
  ('00000000-0000-0000-0000-000000000003', '셋'),
  ('00000000-0000-0000-0000-000000000004', '넷'),
  ('00000000-0000-0000-0000-000000000005', '다섯');
insert into public.foods (name, tags) values ('t_a', array[]::text[]), ('t_b', array[]::text[]);

insert into public.groups (id, name, invite_code, created_by) values
  ('10000000-0000-0000-0000-000000000001', '모임 하나', 'TESTAB', '00000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002', '모임 둘', 'TESTCD', '00000000-0000-0000-0000-000000000001');
insert into public.sessions (id, group_id, host_user_id, status)
select ('20000000-0000-0000-0000-00000000000' || n)::uuid, g::uuid, '00000000-0000-0000-0000-000000000001', 'done'
from (values
  (1, '10000000-0000-0000-0000-000000000001'),
  (2, '10000000-0000-0000-0000-000000000001'),
  (3, '10000000-0000-0000-0000-000000000002'),
  (4, '10000000-0000-0000-0000-000000000001'),
  (5, '10000000-0000-0000-0000-000000000001')
) as v (n, g);
insert into public.meals (id, group_id, session_id, food_id)
select ('30000000-0000-0000-0000-00000000000' || n)::uuid, g::uuid,
  ('20000000-0000-0000-0000-00000000000' || n)::uuid, (select id from public.foods where name = f)
from (values
  (1, '10000000-0000-0000-0000-000000000001', 't_a'),
  (2, '10000000-0000-0000-0000-000000000001', 't_a'),
  (3, '10000000-0000-0000-0000-000000000002', 't_b'),
  (4, '10000000-0000-0000-0000-000000000001', 't_b'),
  (5, '10000000-0000-0000-0000-000000000001', 't_b')
) as v (n, g, f);
insert into public.meal_participants (meal_id, user_id)
select ('30000000-0000-0000-0000-00000000000' || n)::uuid, ('00000000-0000-0000-0000-00000000000' || u)::uuid
from (values (1,1),(1,2),(1,3), (2,1),(2,2), (3,1),(3,2), (4,2),(4,3), (5,1),(5,4)) as v (n, u);

-- 하나: 1, 2, 3, 5번 식사. 4번에는 없었다 --------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$ select f.name, c.meal_count from public.my_food_counts() c join public.foods f on f.id = c.food_id $$,
  $$ values ('t_a'::text, 2), ('t_b'::text, 2) $$,
  '내가 있던 식사만 음식별로 센다. 같으면 food_id 순');
select results_eq(
  $$ select user_id, display_name, meal_count from public.my_companions() $$,
  $$ values
    ('00000000-0000-0000-0000-000000000002'::uuid, '둘'::text, 3),
    ('00000000-0000-0000-0000-000000000004'::uuid, '넷'::text, 1),
    ('00000000-0000-0000-0000-000000000003'::uuid, '셋'::text, 1) $$,
  '같이 먹은 사람은 많은 순, 같으면 이름 순. 내가 없던 4번은 세지 않는다');
select is(
  (select count(*)::int from public.my_companions() where user_id = '00000000-0000-0000-0000-000000000001'),
  0, 'my_companions에 나는 없다');
reset role;

-- 넷: 5번 식사뿐 -----------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$ select f.name, c.meal_count from public.my_food_counts() c join public.foods f on f.id = c.food_id $$,
  $$ values ('t_b'::text, 1) $$,
  '먹은 음식만 나온다');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
insert into public.meal_participants (meal_id, user_id) values ('30000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000002');
set local role authenticated;
select results_eq(
  $$ select f.name, c.meal_count from public.my_food_counts() c join public.foods f on f.id = c.food_id $$,
  $$ values ('t_b'::text, 3), ('t_a'::text, 2) $$,
  '음식은 많은 순');
reset role;

-- 식사가 없는 사람 ---------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.my_food_counts()), 0, '식사가 없으면 빈 결과');
select is((select count(*)::int from public.my_companions()), 0, '같이 먹은 사람이 없으면 빈 결과');
reset role;

select * from finish();
rollback;
