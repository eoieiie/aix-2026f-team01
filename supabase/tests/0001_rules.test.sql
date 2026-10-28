-- 명세 6절 서버 규칙: 거부권, 투표 상한, 룰렛 대상과 확률.
-- 준비는 postgres로 표에 직접 넣고, 확인할 동작은 사용자로 서버 함수를 불러서 본다.
begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

-- 준비 ------------------------------------------------------------------
insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000000001'),  -- 방장
  ('00000000-0000-0000-0000-000000000002'),  -- 매운 것 알레르기
  ('00000000-0000-0000-0000-000000000003');  -- 채식, t_target 안 먹음

insert into public.foods (name, tags) values
  ('t_spicy', array['spicy']),
  ('t_plain', array[]::text[]),
  ('t_target', array['veg_ok']),
  ('t_pork', array['pork']),
  ('t_veg', array['veg_ok']),
  ('t_veg2', array['veg_ok']),
  ('t_veg3', array['veg_ok']);

insert into public.groups (id, name, invite_code, created_by) values
  ('10000000-0000-0000-0000-000000000001', '테스트 모임', 'TESTAB', '00000000-0000-0000-0000-000000000001');
insert into public.memberships (group_id, user_id, display_name) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '하나'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '둘'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', '셋');

insert into public.restrictions (user_id, tag, food_id, kind) values
  ('00000000-0000-0000-0000-000000000002', 'spicy', null, 'allergy'),
  ('00000000-0000-0000-0000-000000000003', 'vegetarian', null, 'belief'),
  ('00000000-0000-0000-0000-000000000003', null, (select id from public.foods where name = 't_target'), 'dislike');

insert into public.sessions (id, group_id, host_user_id) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001');

create function pg_temp.vetoed(p_session text, p_food text) returns boolean
language sql as $$
  select vetoed from public.candidates
  where session_id = p_session::uuid and food_id = (select id from public.foods where name = p_food)
$$;

-- 거부권 ----------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select public.join_session('20000000-0000-0000-0000-000000000001');
select public.add_candidate('20000000-0000-0000-0000-000000000001', id)
from public.foods where name in ('t_spicy', 't_plain', 't_target', 't_pork', 't_veg', 't_veg2', 't_veg3');
reset role;

select is(pg_temp.vetoed('20000000-0000-0000-0000-000000000001', 't_spicy'), false,
  '못 먹는 사람이 아직 없으면 매운 음식도 남는다');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select public.join_session('20000000-0000-0000-0000-000000000001');
reset role;

select is(pg_temp.vetoed('20000000-0000-0000-0000-000000000001', 't_spicy'), true,
  '재료 태그: 매운 것 알레르기인 사람이 들어오면 매운 음식이 빠진다');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select public.join_session('20000000-0000-0000-0000-000000000001');
reset role;

select is(pg_temp.vetoed('20000000-0000-0000-0000-000000000001', 't_plain'), true,
  '식단 태그: 채식인 사람이 있으면 veg_ok가 없는 음식이 빠진다');
select is(pg_temp.vetoed('20000000-0000-0000-0000-000000000001', 't_target'), true,
  '음식 지정: 안 먹는다고 고른 음식은 veg_ok가 있어도 빠진다');
select is(pg_temp.vetoed('20000000-0000-0000-0000-000000000001', 't_veg'), false,
  '상관없는 음식은 남는다');

-- 못 먹는 것을 바꾸면 다시 판정한다
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select public.set_my_restrictions('[]'::jsonb);
reset role;
select is(pg_temp.vetoed('20000000-0000-0000-0000-000000000001', 't_plain'), false,
  '못 먹는 것을 전부 해제하면 그 사람 때문에 빠진 후보가 돌아온다');

set local role authenticated;
select public.set_my_restrictions(jsonb_build_array(
  jsonb_build_object('tag', 'vegetarian', 'kind', 'belief'),
  jsonb_build_object('food_id', (select id from public.foods where name = 't_target'), 'kind', 'dislike')
));
reset role;
select is(pg_temp.vetoed('20000000-0000-0000-0000-000000000001', 't_plain'), true,
  '다시 등록하면 진행 중인 판의 후보가 다시 빠진다');

-- 원인은 남기지 않는다
select columns_are('public', 'candidates',
  array['session_id', 'food_id', 'proposed_by', 'pitch', 'vetoed', 'created_at'],
  '후보 표에는 빠졌는지만 있고 원인이 된 사람 칸이 없다');

-- 투표 시작 -------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select public.open_voting('20000000-0000-0000-0000-000000000001') $$,
  'P0001', 'not_host', '방장이 아니면 투표를 열 수 없다');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$ select public.open_voting('20000000-0000-0000-0000-000000000001') $$,
  '방장은 투표를 연다');
select throws_ok(
  $$ select public.add_candidate('20000000-0000-0000-0000-000000000001', (select id from public.foods where name = '김치찌개')) $$,
  'P0001', 'voting_started', '투표가 시작되면 후보를 올릴 수 없다');
reset role;

-- 투표 상한 -------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is(public.cast_vote('20000000-0000-0000-0000-000000000001', (select id from public.foods where name = 't_veg')),
  true, '첫 번째 표');
select is(public.cast_vote('20000000-0000-0000-0000-000000000001', (select id from public.foods where name = 't_veg2')),
  true, '두 번째 표');
select throws_ok(
  $$ select public.cast_vote('20000000-0000-0000-0000-000000000001', (select id from public.foods where name = 't_veg3')) $$,
  'P0001', 'vote_limit', '세 번째 표는 거절된다');
select is(public.cast_vote('20000000-0000-0000-0000-000000000001', (select id from public.foods where name = 't_veg')),
  false, '같은 후보를 다시 누르면 취소된다');
select is(public.cast_vote('20000000-0000-0000-0000-000000000001', (select id from public.foods where name = 't_veg3')),
  true, '취소한 뒤에는 다른 후보를 찍을 수 있다');
select throws_ok(
  $$ select public.cast_vote('20000000-0000-0000-0000-000000000001', (select id from public.foods where name = 't_spicy')) $$,
  'P0001', 'candidate_vetoed', '빠진 후보는 찍을 수 없다');
select is(
  (select voted from public.session_participants
   where session_id = '20000000-0000-0000-0000-000000000001' and user_id = '00000000-0000-0000-0000-000000000002'),
  true, '투표했는지는 참여자 단위로 보인다');
select throws_ok($$ select * from public.session_vote_counts('20000000-0000-0000-0000-000000000001') $$,
  'P0001', 'not_done', '투표 중에는 음식별 표 수를 받을 수 없다');
reset role;

-- 룰렛: 1표 이상 받은 후보만 -------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select * from public.spin_roulette('20000000-0000-0000-0000-000000000001') $$,
  'P0001', 'not_host', '방장이 아니면 돌릴 수 없다');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select ok(
  (select f.name from public.spin_roulette('20000000-0000-0000-0000-000000000001') r
   join public.foods f on f.id = r.food_id) in ('t_veg2', 't_veg3'),
  '표를 받은 후보(t_veg2, t_veg3) 중에서만 뽑힌다');
select is(
  (select status from public.sessions where id = '20000000-0000-0000-0000-000000000001'),
  'done', '결과가 정해지면 판이 끝난다');
select is(
  (select count(*)::int from public.meal_participants mp
   join public.meals m on m.id = mp.meal_id
   where m.session_id = '20000000-0000-0000-0000-000000000001'),
  3, '식사 기록이 생기고 참여자 전원이 들어간다');
select is(
  (select vote_count from public.session_vote_counts('20000000-0000-0000-0000-000000000001') c
   join public.foods f on f.id = c.food_id where f.name = 't_veg2'),
  1, '끝난 판에서는 음식별 표 수를 받는다');
reset role;

-- 룰렛: 아무도 안 찍으면 빠지지 않은 후보 전체, 빠진 후보는 제외 ----------
insert into public.sessions (id, group_id, host_user_id) values
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select public.join_session('20000000-0000-0000-0000-000000000002');
select public.add_candidate('20000000-0000-0000-0000-000000000002', id)
from public.foods where name in ('t_veg', 't_veg2', 't_pork');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select public.join_session('20000000-0000-0000-0000-000000000002');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select public.open_voting('20000000-0000-0000-0000-000000000002');
select ok(
  (select f.name from public.spin_roulette('20000000-0000-0000-0000-000000000002') r
   join public.foods f on f.id = r.food_id) in ('t_veg', 't_veg2'),
  '아무도 안 찍으면 빠지지 않은 후보 중에서 뽑고, 빠진 t_pork는 나오지 않는다');
reset role;

-- 확률: 표 수에 비례 ----------------------------------------------------
select is(public.pick_weighted(array[10, 20]::bigint[], array[3, 1], 0), 10::bigint, '3:1에서 r=0이면 앞 후보');
select is(public.pick_weighted(array[10, 20]::bigint[], array[3, 1], 0.74), 10::bigint, '3:1에서 r=0.74면 앞 후보 (앞 75%)');
select is(public.pick_weighted(array[10, 20]::bigint[], array[3, 1], 0.75), 20::bigint, '3:1에서 r=0.75면 뒤 후보 (뒤 25%)');
select is(public.pick_weighted(array[10, 20]::bigint[], array[0, 0], 0.5), null::bigint, '가중치가 모두 0이면 뽑지 않는다');
select ok(
  (select avg((public.pick_weighted(array[10, 20]::bigint[], array[3, 1], random()) = 10)::int)
   from generate_series(1, 20000)) between 0.73 and 0.77,
  '3표:1표를 2만 번 뽑으면 앞 후보가 약 75%');
select ok(
  (select avg((public.pick_weighted(array[10, 20, 30]::bigint[], array[1, 1, 1], random()) = 30)::int)
   from generate_series(1, 20000)) between 0.31 and 0.36,
  '아무도 안 찍었을 때(모두 1)는 균등해서 각 약 1/3');

select * from finish();
rollback;
