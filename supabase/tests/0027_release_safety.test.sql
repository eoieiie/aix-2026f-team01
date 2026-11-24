-- 출시 필수 (명세 4-24, 0027): 금칙어, 신고, 차단, 모임 나가기·방장 넘김, 판 접기, 계정 삭제
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-0000000000a3');
insert into public.groups (id, name, invite_code, created_by) values
  ('20000000-0000-0000-0000-0000000000a1', '출시 하나', 'RELSAA', '00000000-0000-0000-0000-0000000000a1'),
  ('20000000-0000-0000-0000-0000000000a2', '출시 둘', 'RELSAB', '00000000-0000-0000-0000-0000000000a1');
insert into public.memberships (group_id, user_id, display_name, joined_at) values
  ('20000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1', '가', now() - interval '3 hour'),
  ('20000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2', '나', now() - interval '2 hour'),
  ('20000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a3', '다', now() - interval '1 hour'),
  ('20000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a1', '가', now());
insert into public.foods (name, tags) values ('t출1', array[]::text[]);
insert into public.sessions (id, group_id, host_user_id) values
  ('30000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2');
insert into public.session_participants (session_id, user_id) values
  ('30000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1'),
  ('30000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2');
insert into public.candidates (session_id, food_id, proposed_by, pitch)
select '30000000-0000-0000-0000-0000000000a1', id, '00000000-0000-0000-0000-0000000000a2', '맛있어요' from public.foods where name = 't출1';

-- 금칙어
select ok(public.has_blocked_word('우리 씨 발 모임'), '띄어 써도 걸린다');
select ok(not public.has_blocked_word('점심 먹는 사람들'), '보통 이름은 통과');
select throws_ok($$ insert into public.groups (name, invite_code, created_by) values ('개새끼들', 'RELSAC', '00000000-0000-0000-0000-0000000000a1') $$,
  'P0001', 'blocked_word', '모임 이름 금칙어 거절');
select throws_ok($$ update public.candidates set pitch = '병신 메뉴' where proposed_by = '00000000-0000-0000-0000-0000000000a2' $$,
  'P0001', 'blocked_word', '한 줄 어필 금칙어 거절');

-- 가(a1)로
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;

select lives_ok($$ select public.report_content('pitch', 'abuse', '20000000-0000-0000-0000-0000000000a1',
  '30000000-0000-0000-0000-0000000000a1', (select id from public.foods where name = 't출1')) $$, '어필 신고');
select lives_ok($$ select public.block_user('00000000-0000-0000-0000-0000000000a2') $$, '같은 모임 사람 차단');
select is((select count(*)::int from public.blocks), 1, '내 차단은 내가 읽는다');
select is((select display_name from public.my_blocks()), '나', '차단한 사람 이름');
select throws_ok($$ select public.cancel_session('30000000-0000-0000-0000-0000000000a1') $$, 'P0001', 'not_host', '판을 연 사람만 접는다');
select throws_ok($$ select public.rename_group('20000000-0000-0000-0000-0000000000a1', '씨발') $$, 'P0001', 'blocked_word', '이름 바꾸기도 금칙어');

-- 가가 모임 하나를 나간다: 방장은 다음으로 먼저 들어온 나(a2)에게
select lives_ok($$ select public.leave_group('20000000-0000-0000-0000-0000000000a1') $$, '모임 나가기');
reset role;
select is((select created_by from public.groups where id = '20000000-0000-0000-0000-0000000000a1'),
  '00000000-0000-0000-0000-0000000000a2'::uuid, '방장은 가장 먼저 들어온 남은 사람에게');
select is((select count(*)::int from public.session_participants where user_id = '00000000-0000-0000-0000-0000000000a1'), 0, '나간 사람은 진행 중인 판에서 빠진다');

-- 나(a2)가 판을 접는다: 기록이 남지 않는다
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$ select public.cancel_session('30000000-0000-0000-0000-0000000000a1') $$, '판을 연 사람은 접는다');

-- 가(a1) 계정 삭제: 혼자인 모임 둘은 지워지고 계정이 없어진다
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select lives_ok($$ select public.delete_my_account() $$, '계정 삭제');
reset role;
select is((select count(*)::int from auth.users where id = '00000000-0000-0000-0000-0000000000a1')
  + (select count(*)::int from public.groups where id = '20000000-0000-0000-0000-0000000000a2'), 0,
  '계정과 혼자 남았던 모임이 지워진다');

select * from finish();
rollback;
