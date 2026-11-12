-- 식단은 재료로만 본다, 사람이 들어와도 표가 남는다 (0012)
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

select is(public.restriction_blocks(1, array['pork'], 'halal', null), true, '할랄: 돼지고기가 든 음식은 걸린다');
select is(public.restriction_blocks(1, array['beef'], 'halal', null), false, '할랄: 짝 표시가 없어도 돼지고기가 없으면 걸리지 않는다');
select is(public.restriction_blocks(1, array['seafood'], 'vegetarian', null), true, '채식: 해산물은 걸린다');
select is(public.restriction_blocks(1, array['wheat'], 'vegetarian', null), false, '채식: 고기, 해산물이 없으면 걸리지 않는다');
select is(public.restriction_blocks(1, array['dairy'], 'vegan', null), true, '비건: 유제품도 걸린다');

insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');
insert into public.foods (name, tags) values ('d_pork', array['pork']);
insert into public.groups (id, name, invite_code, created_by) values
  ('10000000-0000-0000-0000-000000000001', '식단 모임', 'TESTDS', '00000000-0000-0000-0000-000000000001');
insert into public.memberships (group_id, user_id, display_name) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '하나'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '둘');
insert into public.restrictions (user_id, tag, food_id) values
  ('00000000-0000-0000-0000-000000000002', 'halal', null);
insert into public.sessions (id, group_id, host_user_id) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select public.join_session('20000000-0000-0000-0000-000000000001');
select public.add_candidate('20000000-0000-0000-0000-000000000001', (select id from public.foods where name = 'd_pork'));
select public.open_voting('20000000-0000-0000-0000-000000000001');
select public.cast_vote('20000000-0000-0000-0000-000000000001', (select id from public.foods where name = 'd_pork'));
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select public.join_session('20000000-0000-0000-0000-000000000001');
select is((select array_agg(tag) from public.session_cant_eat('20000000-0000-0000-0000-000000000001')),
  array['pork'], '할랄인 사람이 들어오면 안내는 "돼지고기"로 나온다');
reset role;
select is((select count(*)::int from public.votes where session_id = '20000000-0000-0000-0000-000000000001'), 1,
  '걸리는 사람이 들어와도 이미 찍은 표는 남는다');

select * from finish();
rollback;
