-- 판이 닫혔는지 (0031): 판이 있는지만 알려 주고, 신고에 처리 표시 칸이 있다
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);
insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000b1');
insert into public.groups (id, name, invite_code, created_by) values
  ('20000000-0000-0000-0000-0000000000b1', '닫힘 시험', 'GONEAA', '00000000-0000-0000-0000-0000000000b1');
insert into public.sessions (id, group_id, host_user_id) values
  ('30000000-0000-0000-0000-0000000000b1', '20000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b1');
select ok(public.session_exists('30000000-0000-0000-0000-0000000000b1'), '있는 판은 true');
select ok(not public.session_exists('30000000-0000-0000-0000-0000000000b9'), '없는 판은 false');
select has_column('public', 'reports', 'handled_at', '신고에 처리 시각 칸');
select * from finish();
rollback;
