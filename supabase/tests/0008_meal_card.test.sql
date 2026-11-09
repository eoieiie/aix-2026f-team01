-- 결과 카드(4-17): 몇 번째는 "이 식사까지" 센다. 뒤에 식사가 더 있어도 늘지 않는다.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000003'),
  ('00000000-0000-0000-0000-000000000004'),  -- 모임 밖 사람
  ('00000000-0000-0000-0000-000000000005');  -- 소속이지만 식사에는 없음
insert into public.profiles (user_id, display_name) values
  ('00000000-0000-0000-0000-000000000001', '프로필 하나'),
  ('00000000-0000-0000-0000-000000000002', '프로필 둘'),
  ('00000000-0000-0000-0000-000000000003', '프로필 셋');
insert into public.foods (name, tags) values ('t_a', array[]::text[]), ('t_b', array[]::text[]);

insert into public.groups (id, name, invite_code, created_by) values
  ('10000000-0000-0000-0000-000000000001', '모임 하나', 'TESTAB', '00000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002', '모임 둘', 'TESTCD', '00000000-0000-0000-0000-000000000001');
insert into public.memberships (group_id, user_id, display_name) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '하나'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '둘'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', '셋'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000005', '다섯'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '하나 둘째'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', '둘 둘째');

-- 식사 순서: 1(모임 하나 t_a) 2(모임 둘 t_a) 5와 6(모임 하나 t_b, 같은 시각) 3(모임 하나 t_a) 4(모임 하나 t_a)
insert into public.sessions (id, group_id, host_user_id, status)
select ('20000000-0000-0000-0000-00000000000' || n)::uuid, g::uuid, '00000000-0000-0000-0000-000000000001', 'done'
from (values
  (1, '10000000-0000-0000-0000-000000000001'),
  (2, '10000000-0000-0000-0000-000000000002'),
  (3, '10000000-0000-0000-0000-000000000001'),
  (4, '10000000-0000-0000-0000-000000000001'),
  (5, '10000000-0000-0000-0000-000000000001'),
  (6, '10000000-0000-0000-0000-000000000001')
) as v (n, g);
insert into public.meals (id, group_id, session_id, food_id, eaten_at)
select ('30000000-0000-0000-0000-00000000000' || n)::uuid, g::uuid,
  ('20000000-0000-0000-0000-00000000000' || n)::uuid, (select id from public.foods where name = f), t::timestamptz
from (values
  (1, '10000000-0000-0000-0000-000000000001', 't_a', '2026-11-01 12:00+09'),
  (2, '10000000-0000-0000-0000-000000000002', 't_a', '2026-11-02 12:00+09'),
  (5, '10000000-0000-0000-0000-000000000001', 't_b', '2026-11-02 18:00+09'),
  (6, '10000000-0000-0000-0000-000000000001', 't_b', '2026-11-02 18:00+09'),
  (3, '10000000-0000-0000-0000-000000000001', 't_a', '2026-11-03 12:00+09'),
  (4, '10000000-0000-0000-0000-000000000001', 't_a', '2026-11-04 12:00+09')
) as v (n, g, f, t);
insert into public.meal_participants (meal_id, user_id)
select ('30000000-0000-0000-0000-00000000000' || n)::uuid, ('00000000-0000-0000-0000-00000000000' || u)::uuid
from (values (1,1),(1,2),(1,3), (2,1),(2,2), (3,1),(3,2), (4,1),(4,2),(4,3), (5,1),(5,3), (6,2)) as v (n, u);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

-- 하나가 3번 식사를 본다. 뒤에 4번 식사가 더 있다 ----------------------------
select is(
  public.meal_card('30000000-0000-0000-0000-000000000003') - 'eaten_at' - 'food_id',
  '{"group_name": "모임 하나",
    "group_food_nth": 2,
    "my_food_nth": 3,
    "people": [
      {"user_id": "00000000-0000-0000-0000-000000000002", "display_name": "둘", "together_nth": 3},
      {"user_id": "00000000-0000-0000-0000-000000000001", "display_name": "하나", "together_nth": null}
    ]}'::jsonb,
  '이 식사까지 센다. 이름은 그 모임 이름, 나 자신의 together_nth는 null. 모임이 달라도 나의 n번째와 같이 먹은 수에 든다');
select is(
  (public.meal_card('30000000-0000-0000-0000-000000000003') ->> 'eaten_at')::timestamptz,
  '2026-11-03 12:00+09'::timestamptz, '먹은 시각');
select is(
  (public.meal_card('30000000-0000-0000-0000-000000000003') ->> 'food_id')::bigint,
  (select id from public.foods where name = 't_a'), '음식 번호');

-- 첫 식사와 마지막 식사 --------------------------------------------------------
select is(
  public.meal_card('30000000-0000-0000-0000-000000000001') - 'eaten_at' - 'food_id' - 'group_name',
  '{"group_food_nth": 1,
    "my_food_nth": 1,
    "people": [
      {"user_id": "00000000-0000-0000-0000-000000000002", "display_name": "둘", "together_nth": 1},
      {"user_id": "00000000-0000-0000-0000-000000000003", "display_name": "셋", "together_nth": 1},
      {"user_id": "00000000-0000-0000-0000-000000000001", "display_name": "하나", "together_nth": null}
    ]}'::jsonb,
  '첫 식사는 모두 1번째');
select is(
  public.meal_card('30000000-0000-0000-0000-000000000004') - 'eaten_at' - 'food_id' - 'group_name',
  '{"group_food_nth": 3,
    "my_food_nth": 4,
    "people": [
      {"user_id": "00000000-0000-0000-0000-000000000002", "display_name": "둘", "together_nth": 4},
      {"user_id": "00000000-0000-0000-0000-000000000003", "display_name": "셋", "together_nth": 3},
      {"user_id": "00000000-0000-0000-0000-000000000001", "display_name": "하나", "together_nth": null}
    ]}'::jsonb,
  '마지막 식사까지 센 값. 다른 음식을 같이 먹은 것도 같이 먹은 수에 든다');

-- 시각이 같은 식사는 "늦지 않은 것"이라 함께 센다 ------------------------------
select is(
  (public.meal_card('30000000-0000-0000-0000-000000000005') ->> 'group_food_nth')::int,
  2, '시각이 같은 식사도 센다');
reset role;

-- 식사에 없던 소속 -----------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select ok(
  (public.meal_card('30000000-0000-0000-0000-000000000003') -> 'my_food_nth') = 'null'::jsonb,
  '내가 없던 식사면 my_food_nth는 null. 전에 같은 음식을 먹었어도 그렇다');
select is(
  (public.meal_card('30000000-0000-0000-0000-000000000003') ->> 'group_food_nth')::int,
  2, '내가 없던 식사도 모임에서 몇 번째인지는 나온다');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;
select is(
  public.meal_card('30000000-0000-0000-0000-000000000003') -> 'people' -> 0 -> 'together_nth',
  '0'::jsonb, '같이 먹은 적이 없으면 0');
reset role;

-- 실패 ----------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ select public.meal_card('30000000-0000-0000-0000-000000000001') $$,
  'P0001', 'not_member', '소속이 아니면 거절');
select throws_ok(
  $$ select public.meal_card('30000000-0000-0000-0000-000000000099') $$,
  'P0001', 'meal_not_found', '없는 식사');
reset role;

select * from finish();
rollback;
