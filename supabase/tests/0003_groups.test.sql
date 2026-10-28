-- 모임 함수(4-2, 4-5)와 못 먹는 것 저장의 실패 코드(4-7).
-- C와 D가 바로 부르는 함수라 실패 코드까지 고정한다.
begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000000001'),  -- 프로필 없음
  ('00000000-0000-0000-0000-000000000002'),  -- 프로필 없음, 링크로 참여
  ('00000000-0000-0000-0000-000000000003'),  -- 프로필에 이름 있음
  ('00000000-0000-0000-0000-000000000004');  -- 못 먹는 것 저장
insert into public.profiles (user_id, display_name) values ('00000000-0000-0000-0000-000000000003', '셋');

-- 사용자로 부른 함수의 결과를 담아 두는 곳
create temp table t_group (group_id uuid, invite_code text);
grant all on t_group to authenticated;

-- 모임 만들기 (4-2) ------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select * from public.create_group('  ', '하나') $$, 'P0001', 'name_empty', '모임 이름이 비면 거절');
select throws_ok($$ select * from public.create_group(repeat('가', 41), '하나') $$, 'P0001', 'name_too_long', '모임 이름 41자는 거절');
select throws_ok($$ select * from public.create_group('점심팟', null) $$, 'P0001', 'display_name_required', '프로필 이름이 없으면 내 이름이 필요하다');
select throws_ok($$ select * from public.create_group('점심팟', repeat('가', 21)) $$, 'P0001', 'name_too_long', '내 이름 21자는 거절');
insert into t_group select * from public.create_group(' 점심팟 ', '하나');
select matches((select invite_code from t_group), '^[A-HJ-NP-Z2-9]{6}$', '초대 코드는 6자, 0 O 1 I 없음');
reset role;

select is(
  (select m.display_name from public.memberships m join t_group t on t.group_id = m.group_id
   where m.user_id = '00000000-0000-0000-0000-000000000001'),
  '하나', '만든 사람이 첫 소속이 된다');
select is(
  (select g.name from public.groups g join t_group t on t.group_id = g.id),
  '점심팟', '모임 이름의 앞뒤 공백은 지운다');
select is(
  (select display_name from public.profiles where user_id = '00000000-0000-0000-0000-000000000001'),
  '하나', '프로필이 없으면 이름만 담긴 프로필이 생긴다');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$ select * from public.create_group('저녁팟', null) $$, '프로필 이름이 있으면 내 이름을 묻지 않는다');
reset role;
select is(
  (select m.display_name from public.memberships m join public.groups g on g.id = m.group_id where g.name = '저녁팟'),
  '하나', '그때는 프로필 이름으로 들어간다');

-- 초대 링크로 참여 (4-5) --------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.groups), 0, '들어가기 전에는 모임이 안 보인다');
select results_eq(
  $$ select name, is_member from public.get_group_by_code(lower((select invite_code from t_group))) $$,
  $$ values ('점심팟'::text, false) $$,
  '코드로 모임 이름을 본다. 소문자로 적어도 된다');
select throws_ok($$ select * from public.get_group_by_code('ZZZZZZ') $$, 'P0001', 'group_not_found', '없는 코드');
select throws_ok(
  $$ select * from public.join_group((select invite_code from t_group), '하나') $$,
  'P0001', 'name_taken', '같은 모임에 같은 이름이 있으면 거절');
select throws_ok($$ select * from public.join_group('ZZZZZZ', '둘') $$, 'P0001', 'group_not_found', '없는 코드로는 들어갈 수 없다');
select is(
  (select open_session_id from public.join_group((select invite_code from t_group), '둘')),
  null::uuid, '진행 중인 판이 없으면 open_session_id는 null');
select is((select count(*)::int from public.groups), 1, '들어간 뒤에는 모임이 보인다');
select lives_ok(
  $$ select * from public.join_group((select invite_code from t_group)) $$,
  '이미 소속이면 이름을 묻지 않고 넘어간다');
reset role;

insert into public.sessions (id, group_id, host_user_id)
select '20000000-0000-0000-0000-000000000001', group_id, '00000000-0000-0000-0000-000000000001' from t_group;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select open_session_id from public.join_group((select invite_code from t_group))),
  '20000000-0000-0000-0000-000000000001'::uuid, '진행 중인 판이 있으면 그 판 id를 돌려준다');
reset role;
select is(
  (select m.display_name from public.memberships m join t_group t on t.group_id = m.group_id
   where m.user_id = '00000000-0000-0000-0000-000000000003'),
  '셋', '프로필 이름이 있으면 그 이름으로 들어간다');

-- 못 먹는 것 저장의 실패 코드 (4-7) ----------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$ select public.set_my_restrictions('[{"tag":"seafood","kind":"allergy"}]') $$, '올바른 항목은 저장된다');
select throws_ok($$ select public.set_my_restrictions('[{"tag":"meat","kind":"allergy"}]') $$,
  'P0001', 'invalid_items', '없는 태그');
select throws_ok($$ select public.set_my_restrictions('[{"tag":"pork","kind":"allergy"},{"tag":"pork","kind":"dislike"}]') $$,
  'P0001', 'invalid_items', '같은 태그 두 번');
select throws_ok($$ select public.set_my_restrictions('[{"food_id":999999999,"kind":"dislike"}]') $$,
  'P0001', 'invalid_items', '없는 음식 id');
select throws_ok($$ select public.set_my_restrictions('[{"food_id":"abc","kind":"dislike"}]') $$,
  'P0001', 'invalid_items', '숫자가 아닌 food_id');
select throws_ok($$ select public.set_my_restrictions('[{"tag":"pork"}]') $$,
  'P0001', 'invalid_items', 'kind가 빠짐');
select throws_ok($$ select public.set_my_restrictions('[{"tag":"pork","food_id":1,"kind":"dislike"}]') $$,
  'P0001', 'invalid_items', '태그와 음식을 한 항목에 같이 줌');
select results_eq(
  $$ select tag, kind from public.get_my_restrictions() $$,
  $$ values ('seafood'::text, 'allergy'::text) $$,
  '저장에 실패하면 예전 값이 그대로 남는다');
reset role;

select * from finish();
rollback;
