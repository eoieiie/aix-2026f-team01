-- 직접 적은 메뉴 (명세 4-9, 0008): 이름으로 올리기, 재료 짐작, 거부권, 다른 판에서 안 보이기.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- 준비 ------------------------------------------------------------------
insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000000001'),  -- 방장
  ('00000000-0000-0000-0000-000000000002'),  -- 돼지고기 못 먹음
  ('00000000-0000-0000-0000-000000000003'),  -- 다른 모임 사람
  ('00000000-0000-0000-0000-000000000004');  -- 채식

insert into public.foods (name, tags) values ('t김밥', array['pork']), ('t비빔', array['veg_ok']);

insert into public.groups (id, name, invite_code, created_by) values
  ('10000000-0000-0000-0000-000000000001', '테스트 모임', 'TESTAB', '00000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002', '다른 모임', 'TESTCD', '00000000-0000-0000-0000-000000000003');
insert into public.memberships (group_id, user_id, display_name) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '하나'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '둘'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', '셋'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000004', '넷');
insert into public.restrictions (user_id, tag, food_id, kind) values
  ('00000000-0000-0000-0000-000000000002', 'pork', null, 'dislike'),
  ('00000000-0000-0000-0000-000000000004', 'vegetarian', null, 'belief');
insert into public.sessions (id, group_id, host_user_id) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003');

create temp table t_out (r jsonb);
grant all on t_out to authenticated;

-- 재료 짐작 ---------------------------------------------------------------
select is(public.guess_food_tags('평양냉면'), array['beef','wheat'], '낱말 표: 냉면은 소고기, 밀');
select is(public.guess_food_tags('치즈t김밥'), array['dairy','pork'], '목록 음식 이름이 들어 있으면 그 재료를 받고 낱말 태그를 더한다');
select is(public.guess_food_tags('t비빔 정식'), array[]::text[], '목록 음식의 식단 표시(veg_ok)는 받지 않는다');
select is(public.guess_food_tags('버섯 덮밥'), array[]::text[], '모르는 이름은 재료 태그가 없다');

-- 올리기 ----------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select public.join_session('20000000-0000-0000-0000-000000000001');
select throws_ok($$ select public.add_custom_candidate('20000000-0000-0000-0000-000000000001', '  ') $$,
  'P0001', 'name_empty', '빈 이름은 거절');
select throws_ok($$ select public.add_custom_candidate('20000000-0000-0000-0000-000000000001', repeat('가', 21)) $$,
  'P0001', 'name_too_long', '21자는 거절');
insert into t_out select public.add_custom_candidate('20000000-0000-0000-0000-000000000001', ' 평양냉면 ');
select throws_ok($$ select public.add_custom_candidate('20000000-0000-0000-0000-000000000001', '평양냉면') $$,
  'P0001', 'already_candidate', '같은 판에 같은 이름은 한 번만');
select throws_ok($$ select public.add_custom_candidate('20000000-0000-0000-0000-000000000002', '라면') $$,
  'P0001', 'not_member', '소속이 아닌 판에는 올릴 수 없다');
reset role;

select is((select name from public.foods where id = (select (r->>'food_id')::bigint from t_out)), '평양냉면', '앞뒤 공백은 지운다');
select is((select custom from public.foods where name = '평양냉면'), true, '직접 적은 메뉴로 표시된다');
select is((select r->>'vetoed' from t_out), 'false', '못 먹는 사람이 아직 없으면 남는다');

-- 거부권: 돼지고기 못 먹는 사람이 들어오면 짐작한 태그로 빠진다
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select public.join_session('20000000-0000-0000-0000-000000000001');
select is(
  (public.add_custom_candidate('20000000-0000-0000-0000-000000000001', '제육 정식') ->> 'vetoed'),
  'true', '이름에 "제육"이 있으면 돼지고기로 짐작해 바로 빠진다');
select is(
  (select count(*)::int from public.candidates c join public.foods f on f.id = c.food_id
   where c.session_id = '20000000-0000-0000-0000-000000000001' and f.name = '평양냉면'),
  1, '같은 판 사람에게는 직접 적은 메뉴가 보인다');
reset role;

-- 채식: 0012부터 재료로만 본다. 고기가 없다고 짐작한 직접 적은 메뉴는 걸리지 않는다
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.foods where name = '평양냉면'), 0, '다른 모임 사람에게는 직접 적은 메뉴 이름이 안 보인다');
select is((select count(*)::int from public.foods where name = 't김밥'), 1, '기본 목록은 모두에게 보인다');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select public.join_session('20000000-0000-0000-0000-000000000002');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select public.join_session('20000000-0000-0000-0000-000000000002');
select is(
  (public.add_custom_candidate('20000000-0000-0000-0000-000000000002', '버섯 덮밥') ->> 'vetoed'),
  'false', '채식인 사람이 있어도 고기 낱말이 없는 직접 적은 메뉴는 걸리지 않는다 (0012)');
reset role;

select * from finish();
rollback;
