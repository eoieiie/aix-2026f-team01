-- 명세 5절 권한: 테이블에 직접 쓰면 거절, 다른 사람 표는 0행, 소속이 아니면 모임이 안 보인다.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000004');  -- 모임 밖 사람

insert into public.foods (name, tags) values ('t_a', array[]::text[]), ('t_b', array[]::text[]);

insert into public.groups (id, name, invite_code, created_by) values
  ('10000000-0000-0000-0000-000000000001', '테스트 모임', 'TESTAB', '00000000-0000-0000-0000-000000000001');
insert into public.memberships (group_id, user_id, display_name) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '하나'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '둘');
insert into public.sessions (id, group_id, host_user_id, status) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'voting');
insert into public.session_participants (session_id, user_id) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002');
insert into public.candidates (session_id, food_id, proposed_by)
select '20000000-0000-0000-0000-000000000001', id, '00000000-0000-0000-0000-000000000001'
from public.foods where name in ('t_a', 't_b');

-- 두 사람이 서버 함수로 투표
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select public.cast_vote('20000000-0000-0000-0000-000000000001', (select id from public.foods where name = 't_a'));
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select public.cast_vote('20000000-0000-0000-0000-000000000001', (select id from public.foods where name = 't_b'));

-- 표 익명
select is((select count(*)::int from public.votes), 1, '표 전체를 조회하면 내 표 1행만 나온다');
select is(
  (select count(*)::int from public.votes where user_id = '00000000-0000-0000-0000-000000000001'),
  0, '다른 사람의 표를 조회하면 0행');

-- 테이블에 직접 쓰기
select throws_ok(
  $$ insert into public.votes (session_id, user_id, food_id)
     values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
             (select id from public.foods where name = 't_a')) $$,
  '42501', null, '표에 직접 넣을 수 없다');
select throws_ok($$ delete from public.votes $$, '42501', null, '표를 직접 지울 수 없다');
select throws_ok($$ update public.candidates set vetoed = false $$, '42501', null, '후보의 빠짐 여부를 직접 바꿀 수 없다');
select throws_ok(
  $$ insert into public.sessions (group_id, host_user_id)
     values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002') $$,
  '42501', null, '판을 직접 만들 수 없다');
select throws_ok($$ update public.sessions set status = 'done' $$, '42501', null, '판 상태를 직접 바꿀 수 없다');
select throws_ok(
  $$ insert into public.memberships (group_id, user_id, display_name)
     values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '다른이름') $$,
  '42501', null, '모임 소속을 직접 만들 수 없다');
select throws_ok(
  $$ insert into public.restrictions (user_id, tag, kind)
     values ('00000000-0000-0000-0000-000000000002', 'spicy', 'allergy') $$,
  '42501', null, '못 먹는 것을 직접 넣을 수 없다');
select throws_ok(
  $$ select public.refresh_vetoes('20000000-0000-0000-0000-000000000001') $$,
  '42501', null, '내부 함수는 앱에서 부를 수 없다');
reset role;

-- 모임 밖 사람
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.groups), 0, '소속이 아니면 모임이 안 보인다');
select is((select count(*)::int from public.candidates), 0, '소속이 아니면 후보가 안 보인다');
select throws_ok(
  $$ select public.cast_vote('20000000-0000-0000-0000-000000000001', (select id from public.foods where name = 't_a')) $$,
  'P0001', 'not_member', '소속이 아니면 투표할 수 없다');
reset role;

-- 로그인하지 않은 키(anon)
set local role anon;
select throws_ok($$ select count(*) from public.foods $$, '42501', null, '로그인하지 않으면 표를 읽을 수 없다');
reset role;

select * from finish();
rollback;
