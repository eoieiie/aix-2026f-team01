-- 홈 모임 카드의 먹은 음식 줄: 구성원만, 모임끼리 섞이지 않음, 최근 순 최대 4개, 같은 음식 한 번 (0053)
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000005301'),
  ('00000000-0000-0000-0000-000000005302'),
  ('00000000-0000-0000-0000-000000005303');
insert into public.groups (id, name, invite_code, created_by) values
  ('10000000-0000-0000-0000-000000005301', '먹은 음식 가', 'HGFA53', '00000000-0000-0000-0000-000000005301'),
  ('10000000-0000-0000-0000-000000005302', '먹은 음식 나', 'HGFB53', '00000000-0000-0000-0000-000000005302'),
  ('10000000-0000-0000-0000-000000005303', '먹은 음식 다', 'HGFC53', '00000000-0000-0000-0000-000000005301');
insert into public.memberships (group_id, user_id, display_name) values
  ('10000000-0000-0000-0000-000000005301', '00000000-0000-0000-0000-000000005301', '하나'),
  ('10000000-0000-0000-0000-000000005302', '00000000-0000-0000-0000-000000005302', '둘'),
  ('10000000-0000-0000-0000-000000005303', '00000000-0000-0000-0000-000000005301', '하나');
insert into public.foods (name, tags, ai_tags, custom) values
  ('zz_home_가', '{}', '{}', true),
  ('zz_home_나', '{}', '{}', true),
  ('zz_home_다', '{}', '{}', true),
  ('zz_home_라', '{}', '{}', true),
  ('zz_home_마', '{}', '{}', true),
  ('zz_home_남의것', '{}', '{}', true);

-- 가 모임: 가(6일 전), 나(5일 전), 다(4일 전), 가(3일 전, 다시), 라(2일 전), 마(1일 전). 나 모임: 남의것(오늘)
insert into public.sessions (id, group_id, host_user_id, status)
select ('20000000-0000-0000-0000-00000000530' || n)::uuid, '10000000-0000-0000-0000-000000005301', '00000000-0000-0000-0000-000000005301', 'done'
from generate_series(1, 6) n;
insert into public.sessions (id, group_id, host_user_id, status) values
  ('20000000-0000-0000-0000-000000005309', '10000000-0000-0000-0000-000000005302', '00000000-0000-0000-0000-000000005302', 'done');
insert into public.meals (group_id, session_id, food_id, eaten_at)
select '10000000-0000-0000-0000-000000005301', ('20000000-0000-0000-0000-00000000530' || x.n)::uuid,
  (select id from public.foods where name = x.food), now() - (x.days || ' days')::interval
from (values (1, 'zz_home_가', 6), (2, 'zz_home_나', 5), (3, 'zz_home_다', 4), (4, 'zz_home_가', 3), (5, 'zz_home_라', 2), (6, 'zz_home_마', 1)) as x(n, food, days);
insert into public.meals (group_id, session_id, food_id, eaten_at)
select '10000000-0000-0000-0000-000000005302', '20000000-0000-0000-0000-000000005309', id, now()
from public.foods where name = 'zz_home_남의것';

select ok(not has_function_privilege('anon', 'public.home_group_foods()', 'execute'), '미로그인 호출 권한이 없다');
select is(
  (select p.prosecdef and p.proconfig @> array['search_path=""'] from pg_proc p where p.oid = 'public.home_group_foods()'::regprocedure),
  true, 'security definer이고 search_path를 비워 고정한다');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000005301","role":"authenticated"}', true);
select is((select count(*)::int from public.home_group_foods()), 2, '내가 속한 모임만 줄로 나온다');
select is_empty($$ select 1 from public.home_group_foods() where group_id = '10000000-0000-0000-0000-000000005302' $$, '내가 없는 모임은 나오지 않는다');
select is(
  (select array(select e->>'name' from jsonb_array_elements(foods) e) from public.home_group_foods() where group_id = '10000000-0000-0000-0000-000000005301'),
  array['zz_home_마', 'zz_home_라', 'zz_home_가', 'zz_home_다'],
  '최근 순 최대 4개, 같은 음식은 가장 최근 때로 한 번만');
select ok(
  not exists (select 1 from public.home_group_foods() h, jsonb_array_elements(h.foods) e where e->>'name' = 'zz_home_남의것'),
  '다른 모임의 기록은 섞이지 않는다');
select is(
  (select foods from public.home_group_foods() where group_id = '10000000-0000-0000-0000-000000005303'),
  '[]'::jsonb, '같이 먹은 기록이 없는 모임은 빈 줄');
select ok(
  (select bool_and(e ? 'food_id' and e ? 'image_path') from public.home_group_foods() h, jsonb_array_elements(h.foods) e),
  '음식 번호와 그림 파일 이름을 같이 준다');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000005303","role":"authenticated"}', true);
select is_empty($$ select * from public.home_group_foods() $$, '모임이 없는 사람은 아무것도 받지 않는다');

select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok($$ select * from public.home_group_foods() $$, 'P0001', 'not_signed_in', '로그인하지 않으면 거절한다');

select * from finish();
rollback;
