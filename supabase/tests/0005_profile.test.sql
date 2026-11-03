-- 프로필 저장(4-14)의 실패 코드와 축 점수, profiles 권한(5절).
begin;
create extension if not exists pgtap with schema extensions;
select plan(34);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000003');  -- 프로필 없음
insert into public.profiles (user_id, display_name, handle) values
  ('00000000-0000-0000-0000-000000000002', '둘', 'dul_02');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

-- 이름 ------------------------------------------------------------------
select throws_ok($$ select * from public.save_my_profile() $$, 'P0001', 'display_name_required', '프로필이 없는데 이름을 안 주면 거절');
select throws_ok($$ select * from public.save_my_profile(p_handle => 'hana_01') $$, 'P0001', 'display_name_required', '이름 없이 아이디만 주어도 거절');
select throws_ok($$ select * from public.save_my_profile('  ') $$, 'P0001', 'name_empty', '빈 이름 거절');
select throws_ok($$ select * from public.save_my_profile(repeat('가', 21)) $$, 'P0001', 'name_too_long', '이름 21자 거절');
select results_eq(
  $$ select display_name, handle, axes from public.save_my_profile(' 하나 ') $$,
  $$ values ('하나'::text, null::text, null::jsonb) $$,
  '이름을 주면 프로필이 생긴다');

-- 아이디 ----------------------------------------------------------------
select is((select handle from public.save_my_profile(p_handle => 'hana_01')), 'hana_01', '아이디를 저장한다');
select throws_ok($$ select * from public.save_my_profile(p_handle => 'Hana') $$, 'P0001', 'handle_invalid', '대문자 거절');
select throws_ok($$ select * from public.save_my_profile(p_handle => '하나하나') $$, 'P0001', 'handle_invalid', '한글 거절');
select throws_ok($$ select * from public.save_my_profile(p_handle => 'ab') $$, 'P0001', 'handle_invalid', '2자 거절');
select throws_ok($$ select * from public.save_my_profile(p_handle => repeat('a', 17)) $$, 'P0001', 'handle_invalid', '17자 거절');
select throws_ok($$ select * from public.save_my_profile(p_handle => 'dul_02') $$, 'P0001', 'handle_taken', '다른 사람이 쓰는 아이디 거절');
select is((select handle from public.save_my_profile(p_handle => 'hana_01')), 'hana_01', '내 아이디를 그대로 다시 저장하면 성공');
select is((select handle from public.save_my_profile(p_handle => repeat('a', 16))), repeat('a', 16), '16자는 된다');
select is((select handle from public.save_my_profile(p_handle => 'abc')), 'abc', '3자는 된다');

-- 문항 답과 축 점수 -------------------------------------------------------
select is(
  (select axes from public.save_my_profile(p_quiz_answers => '["A","A","A","A","A","A","A","A"]')),
  '{"explore": 1, "spicy": 1, "korean": 1, "lead": 1}'::jsonb, '전부 A면 네 축 모두 1');
select is(
  (select axes from public.save_my_profile(p_quiz_answers => '["B","B","B","B","B","B","B","B"]')),
  '{"explore": -1, "spicy": -1, "korean": -1, "lead": -1}'::jsonb, '전부 B면 네 축 모두 -1');
select is(
  (select axes from public.save_my_profile(p_quiz_answers => '["A","B","B","A","A","B","B","A"]')),
  '{"explore": 0, "spicy": 0, "korean": 0, "lead": 0}'::jsonb, '축마다 A와 B가 하나씩이면 모두 0');
select is(
  (select axes from public.save_my_profile(p_quiz_answers => '["A","A","B","B","A","B","B","B"]')),
  '{"explore": 1, "spicy": -1, "korean": 0, "lead": -1}'::jsonb, '문항 두 개씩 순서대로 탐험, 매운맛, 한식, 주도 축이다');
select throws_ok($$ select * from public.save_my_profile(p_quiz_answers => '["A","A","A","A","A","A","A"]') $$, 'P0001', 'quiz_invalid', '7개 거절');
select throws_ok($$ select * from public.save_my_profile(p_quiz_answers => '["A","A","A","A","A","A","A","A","A"]') $$, 'P0001', 'quiz_invalid', '9개 거절');
select throws_ok($$ select * from public.save_my_profile(p_quiz_answers => '["A","A","A","A","A","A","A","C"]') $$, 'P0001', 'quiz_invalid', 'A, B 밖의 값 거절');
select throws_ok($$ select * from public.save_my_profile(p_quiz_answers => '{"a":1}') $$, 'P0001', 'quiz_invalid', '배열이 아니면 거절');
select is(
  (select quiz_answers from public.profiles where user_id = '00000000-0000-0000-0000-000000000001'),
  '["A","A","B","B","A","B","B","B"]'::jsonb, '거절되면 예전 답이 그대로 남는다');

-- 생략한 칸 ---------------------------------------------------------------
select results_eq(
  $$ select display_name, handle, axes from public.save_my_profile('하나둘') $$,
  $$ values ('하나둘'::text, 'abc'::text, '{"explore": 1, "spicy": -1, "korean": 0, "lead": -1}'::jsonb) $$,
  '이름만 바꿔도 아이디와 축이 지워지지 않는다');
select is(
  (select quiz_answers from public.profiles where user_id = '00000000-0000-0000-0000-000000000001'),
  '["A","A","B","B","A","B","B","B"]'::jsonb, '이름만 바꿔도 답이 지워지지 않는다');
select is(
  (select display_name from public.save_my_profile(p_handle => 'hana_02')),
  '하나둘', '아이디만 바꿔도 이름이 그대로다');
select is(
  (select display_name from public.save_my_profile()),
  '하나둘', '프로필이 있으면 모두 생략해도 그대로 돌려준다');

-- 권한 (5절) --------------------------------------------------------------
select is((select count(*)::int from public.profiles), 1, '내 행만 보인다');
select is(
  (select count(*)::int from public.profiles where user_id = '00000000-0000-0000-0000-000000000002'),
  0, '다른 사람의 행은 조회해도 0행');
select throws_ok(
  $$ update public.profiles set display_name = '바꿈' where user_id = '00000000-0000-0000-0000-000000000001' $$,
  '42501', null, '내 행도 직접 고칠 수 없다');
select throws_ok(
  $$ update public.profiles set handle = 'direct_01' $$,
  '42501', null, '아이디도 직접 고칠 수 없다');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select throws_ok(
  $$ insert into public.profiles (user_id, display_name) values ('00000000-0000-0000-0000-000000000003', '셋') $$,
  '42501', null, '직접 만들 수 없다');
select is((select display_name from public.save_my_profile('셋')), '셋', '서버 함수로는 만들 수 있다');
reset role;

select ok(
  not has_function_privilege('anon', 'public.save_my_profile(text, text, jsonb)', 'execute'),
  '로그인하지 않으면 부를 수 없다');

select * from finish();
rollback;
