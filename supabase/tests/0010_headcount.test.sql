-- 먹을 인원수 (명세 4-6, 4-12, 0009): 판 열 때 인원수, 다 고르기 전에는 못 돌림, 방장만 바꿈.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000000001'),  -- 방장
  ('00000000-0000-0000-0000-000000000002');  -- 친구
insert into public.foods (name, tags) values ('t국밥', array[]::text[]);
insert into public.groups (id, name, invite_code, created_by) values
  ('10000000-0000-0000-0000-000000000001', '인원수 모임', 'TESTHC', '00000000-0000-0000-0000-000000000001');
insert into public.memberships (group_id, user_id, display_name) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '하나'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '둘');

create temp table t_sess (id uuid);
grant all on t_sess to authenticated;

-- 방장이 2명으로 판을 연다
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select public.start_session('10000000-0000-0000-0000-000000000001', 21) $$,
  'P0001', 'bad_headcount', '21명은 거절');
insert into t_sess select public.start_session('10000000-0000-0000-0000-000000000001', 2);
select public.join_session((select id from t_sess));
select public.add_candidate((select id from t_sess), (select id from public.foods where name = 't국밥'));
select public.open_voting((select id from t_sess));
select public.cast_vote((select id from t_sess), (select id from public.foods where name = 't국밥'));
select throws_ok($$ select public.spin_roulette((select id from t_sess)) $$,
  'P0001', 'not_all_voted', '2명 중 1명만 골랐으면 못 돌린다');
reset role;
select is((select expected_count from public.sessions where id = (select id from t_sess)), 2, '인원수가 저장된다');

-- 친구는 인원수를 못 바꾼다
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select public.set_expected_count((select id from t_sess), 1) $$,
  'P0001', 'not_host', '방장만 인원수를 바꾼다');
select is(public.start_session('10000000-0000-0000-0000-000000000001', 5), (select id from t_sess),
  '진행 중인 판이 있으면 그 판으로 간다');
reset role;
select is((select expected_count from public.sessions where id = (select id from t_sess)), 2,
  '진행 중인 판에 들어갈 때는 인원수가 바뀌지 않는다');

-- 방장이 1명으로 줄이면 돌릴 수 있다
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$ select public.set_expected_count((select id from t_sess), 1) $$, '방장은 바꿀 수 있다');
select lives_ok($$ select public.spin_roulette((select id from t_sess)) $$, '인원수만큼 고르면 돌릴 수 있다');
select throws_ok($$ select public.set_expected_count((select id from t_sess), 2) $$,
  'P0001', 'not_voting', '끝난 판은 못 바꾼다');
reset role;

select * from finish();
rollback;
