-- 못 먹는 후보 알리기와 아무거나 괜찮아요 (명세 4-9, 4-11, 0010)
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000000001'),  -- 방장
  ('00000000-0000-0000-0000-000000000002'),  -- 돼지고기 못 먹음, 채식
  ('00000000-0000-0000-0000-000000000003');  -- 다른 모임
insert into public.foods (name, tags) values
  ('s_pork', array['pork']), ('s_veg', array['veg_ok']), ('s_x', array['nuts']);
insert into public.groups (id, name, invite_code, created_by) values
  ('10000000-0000-0000-0000-000000000001', '알림 모임', 'TESTSV', '00000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002', '남의 모임', 'TESTSW', '00000000-0000-0000-0000-000000000003');
insert into public.memberships (group_id, user_id, display_name) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '하나'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '둘'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', '셋');
insert into public.restrictions (user_id, tag, food_id, kind) values
  ('00000000-0000-0000-0000-000000000002', 'pork', null, 'dislike'),
  ('00000000-0000-0000-0000-000000000002', 'nuts', null, 'allergy');
insert into public.sessions (id, group_id, host_user_id, expected_count) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 2);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select public.join_session('20000000-0000-0000-0000-000000000001');
select public.add_candidate('20000000-0000-0000-0000-000000000001', id) from public.foods where name in ('s_pork', 's_veg');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select public.join_session('20000000-0000-0000-0000-000000000001');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select array_agg(tag) from public.session_cant_eat('20000000-0000-0000-0000-000000000001')),
  array['pork'], '후보에 걸리는 것만 알린다 (견과류는 후보에 없어서 안 나온다)');
select lives_ok($$ select public.open_voting('20000000-0000-0000-0000-000000000001') $$,
  '못 먹는 사람이 있는 후보만 남아 있어도 투표를 연다');
select is(public.cast_vote('20000000-0000-0000-0000-000000000001', (select id from public.foods where name = 's_pork')),
  true, '못 먹는 사람이 있는 후보도 찍는다');
select throws_ok($$ select * from public.spin_roulette('20000000-0000-0000-0000-000000000001') $$,
  'P0001', 'not_all_voted', '2명 중 1명만 했으면 못 돌린다');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is(public.set_any_ok('20000000-0000-0000-0000-000000000001'), true, '아무거나 괜찮아요를 누른다');
select is(public.set_any_ok('20000000-0000-0000-0000-000000000001'), false, '다시 누르면 취소된다');
select public.set_any_ok('20000000-0000-0000-0000-000000000001');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select * from public.session_cant_eat('20000000-0000-0000-0000-000000000001') $$,
  'P0001', 'not_member', '다른 모임 사람은 못 본다');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select f.name from public.spin_roulette('20000000-0000-0000-0000-000000000001') r
   join public.foods f on f.id = r.food_id),
  's_pork', '아무거나 괜찮아요도 1명으로 세고, 표를 받은 못 먹는 후보가 뽑힌다');
reset role;
select is(
  (select count(*)::int from public.votes where session_id = '20000000-0000-0000-0000-000000000001'
     and user_id = '00000000-0000-0000-0000-000000000002'),
  0, '아무거나 괜찮아요는 표를 남기지 않는다');

select * from finish();
rollback;
