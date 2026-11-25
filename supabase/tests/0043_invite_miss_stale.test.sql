-- 0043: 지워진 계정의 토큰으로 없는 초대 코드를 열어도 오류 없이 빈 결과
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id) values ('00000000-0000-0000-0000-000000004301');

-- auth.users에 없는 사람(지워진 계정의 토큰)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000004399","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.get_group_by_code('AAAAAA')), 0, '지워진 계정도 없는 코드는 빈 결과(오류 아님)');
reset role;
select is((select count(*)::int from public.invite_misses where user_id = '00000000-0000-0000-0000-000000004399'), 0,
  '없는 계정은 틀린 기록을 남기지 않는다');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000004301","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.get_group_by_code('AAAAAA')), 0, '있는 계정도 없는 코드는 빈 결과');
reset role;
select is((select count(*)::int from public.invite_misses where user_id = '00000000-0000-0000-0000-000000004301'), 1,
  '있는 계정은 그대로 기록한다');

select * from finish();
rollback;
