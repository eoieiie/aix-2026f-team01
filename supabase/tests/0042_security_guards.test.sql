-- 13주차 보안 점검 (docs/security.md, 0042): 표 권한, 함수 설정, 초대 코드 추측, 신고 반복, 직원 확인 비밀번호
begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

-- 구조: 모든 표에 RLS, 로그인 역할에 쓰기와 TRUNCATE 권한 없음, 서버 함수는 search_path 고정
select is((select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity), 0,
  'public의 모든 표에 RLS가 켜져 있다');
select is((select count(*)::int from information_schema.role_table_grants
           where table_schema = 'public' and grantee in ('anon', 'authenticated')
             and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'TRIGGER', 'REFERENCES')), 0,
  '로그인 역할은 표에 직접 쓰거나 비울 수 없다(쓰기는 서버 함수로만)');
select is((select count(*)::int from information_schema.role_table_grants
           where table_schema = 'public' and grantee = 'anon'), 0,
  '로그인 안 한 역할은 표를 하나도 못 읽는다');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.prosecdef
             and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%')), 0,
  'SECURITY DEFINER 함수는 모두 search_path를 고정한다');
select is((select array_agg(p.proname::text order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'EXECUTE')),
  array['owner_board'],
  '로그인 안 한 역할이 부를 수 있는 함수는 사장님 현황(토큰으로 확인) 하나뿐이다');
select is((with pol as materialized (
             select p.tablename from pg_policies p
             where p.schemaname = 'public' and p.cmd = 'SELECT' and 'authenticated' = any (p.roles))
           select count(*)::int from pol join pg_class c on c.relname = pol.tablename
             join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
           where not has_table_privilege('authenticated', c.oid, 'SELECT')), 0,
  '읽기 정책이 있는 표는 모두 읽기 권한도 있다(차단 표가 빠져 있었다)');
select ok(not has_function_privilege('authenticated', 'public.ai_ingredient_apply(bigint, text[], jsonb, text)', 'EXECUTE'),
  'AI 결과 저장은 서버(service role)만');
select ok(not has_function_privilege('authenticated', 'public.invite_miss(uuid)', 'EXECUTE'), '틀린 기록 함수는 바깥에서 못 부른다');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename in ('shop_private', 'app_admins', 'invite_misses', 'pin_misses', 'ai_usage', 'reports')), 0,
  '비밀번호, 운영자, 틀린 기록, 신고 표에는 읽기 정책이 없다');

insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000004201'),  -- 모임 만든 사람
  ('00000000-0000-0000-0000-000000004202'),  -- 코드 맞히기를 해 보는 사람
  ('00000000-0000-0000-0000-000000004203'),  -- 비밀번호를 틀리는 다른 사람들
  ('00000000-0000-0000-0000-000000004204');
insert into public.groups (id, name, invite_code, created_by) values
  ('10000000-0000-0000-0000-000000004201', '보안 모임', 'SECRT2', '00000000-0000-0000-0000-000000004201');
insert into public.memberships (group_id, user_id, display_name) values
  ('10000000-0000-0000-0000-000000004201', '00000000-0000-0000-0000-000000004201', '하나');

-- 초대 코드 추측: 틀리면 빈 결과, 20번 틀리면 맞는 코드도 잠시 막힌다
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000004202","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.get_group_by_code('AAAAAA')), 0, '없는 코드는 빈 결과');
select is((select count(*)::int from public.join_group('AAAAAB', '둘')), 0, '없는 코드로는 못 들어간다');
reset role;
select is((select count(*)::int from public.invite_misses where user_id = '00000000-0000-0000-0000-000000004202'), 2,
  '틀린 코드는 기록이 남는다');
insert into public.invite_misses (user_id) select '00000000-0000-0000-0000-000000004202' from generate_series(1, 18);
set local role authenticated;
select throws_ok($$ select * from public.get_group_by_code('SECRT2') $$, 'P0001', 'too_many_tries',
  '1시간에 20번 틀리면 맞는 코드도 잠시 막힌다');
select throws_ok($$ select * from public.join_group('SECRT2', '둘') $$, 'P0001', 'too_many_tries',
  '들어가기도 같이 막힌다');
reset role;
update public.invite_misses set at = now() - interval '2 hours' where user_id = '00000000-0000-0000-0000-000000004202';
set local role authenticated;
select results_eq($$ select name from public.get_group_by_code('secrt2') $$, $$ values ('보안 모임'::text) $$,
  '1시간이 지나면 다시 된다');
select is((select count(*)::int from public.join_group('SECRT2', '둘')), 1, '맞는 코드로는 들어간다');
reset role;

-- 신고 반복: 같은 글은 하루에 한 번만 남고, 하루 20번까지
set local role authenticated;
select lives_ok($$ select public.report_content('group_name', 'spam', '10000000-0000-0000-0000-000000004201') $$, '신고한다');
select lives_ok($$ select public.report_content('group_name', 'abuse', '10000000-0000-0000-0000-000000004201') $$, '같은 글을 다시 신고해도 오류는 없다');
reset role;
select is((select count(*)::int from public.reports where reporter = '00000000-0000-0000-0000-000000004202'), 1,
  '같은 글 신고는 하루에 한 번만 남는다');
insert into public.reports (reporter, kind, reason, group_id, content)
select '00000000-0000-0000-0000-000000004202', 'member_name', 'spam', null, 'x' from generate_series(1, 19);
set local role authenticated;
select throws_ok($$ select public.report_content('member_name', 'spam', '10000000-0000-0000-0000-000000004201', null, null, '00000000-0000-0000-0000-000000004201') $$,
  'P0001', 'too_many_reports', '한 사람이 하루 20번 넘게 신고할 수 없다');
reset role;

-- 직원 확인 비밀번호: 쿠폰을 새로 받아도 한 사람이 한 가게에 하루 5번까지, 한 가게는 하루 20번까지
insert into public.restaurants (area, name, cuisine, menus, partner, coupon_text, source_id) values
  ('s_test', '비밀번호 집', 'korean', '{}', true, '음료 한 캔', 's/1');
insert into public.shop_private (restaurant_id, staff_pin, owner_token) values
  ((select id from public.restaurants where source_id = 's/1'), '4821', repeat('b', 48));
insert into public.coupon_claims (restaurant_id, session_id, user_id, code, source, claim_day, benefit, party_size, claimed_at)
select (select id from public.restaurants where source_id = 's/1'), null, '00000000-0000-0000-0000-000000004203', 'AAAAA' || d,
  'shop', current_date - d, '음료 한 캔', 1, now() - make_interval(mins => d)
from generate_series(1, 2) d;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000004203","role":"authenticated"}', true);
set local role authenticated;
select is(public.redeem_coupon((select id from public.coupon_claims where code = 'AAAAA1'), '0000') ->> 'reason', 'wrong_pin', '한 쿠폰에 틀린다 1');
select is(public.redeem_coupon((select id from public.coupon_claims where code = 'AAAAA1'), '0000') ->> 'reason', 'wrong_pin', '한 쿠폰에 틀린다 2');
select is(public.redeem_coupon((select id from public.coupon_claims where code = 'AAAAA1'), '0000') ->> 'reason', 'wrong_pin', '한 쿠폰에 틀린다 3');
select is(public.redeem_coupon((select id from public.coupon_claims where code = 'AAAAA1'), '0000') ->> 'reason', 'wrong_pin', '한 쿠폰에 틀린다 4');
select is(public.redeem_coupon((select id from public.coupon_claims where code = 'AAAAA2'), '0000') ->> 'reason', 'wrong_pin',
  '다른 쿠폰으로 다섯 번째를 틀린다');
select is(public.redeem_coupon((select id from public.coupon_claims where code = 'AAAAA2'), '4821') ->> 'reason', 'locked',
  '다른 쿠폰으로 바꿔도 한 가게에 하루 5번 틀리면 맞게 넣어도 잠긴다');
reset role;
insert into public.pin_misses (restaurant_id, user_id)
select (select id from public.restaurants where source_id = 's/1'), '00000000-0000-0000-0000-000000004204' from generate_series(1, 15);
insert into public.coupon_claims (restaurant_id, session_id, user_id, code, source, claim_day, benefit, party_size)
values ((select id from public.restaurants where source_id = 's/1'), null, '00000000-0000-0000-0000-000000004201', 'BBBBB1',
  'shop', current_date, '음료 한 캔', 1);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000004201","role":"authenticated"}', true);
set local role authenticated;
select is(public.redeem_coupon((select id from public.coupon_claims where code = 'BBBBB1'), '4821') ->> 'reason', 'locked',
  '한 가게에 하루 20번 틀리면 그날은 다른 사람도 비밀번호로 못 쓴다(계정을 여러 개 만들어 맞히기 막기)');
reset role;
delete from public.pin_misses;
set local role authenticated;
select is(public.redeem_coupon((select id from public.coupon_claims where code = 'BBBBB1'), '4821') ->> 'ok', 'true',
  '다음 날(기록이 없으면) 맞는 비밀번호로 쓴다');
reset role;

select * from finish();
rollback;
