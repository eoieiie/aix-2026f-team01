-- 식사 기록 힌트 (명세 4-20, 0011)
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000000001'),  -- 방장
  ('00000000-0000-0000-0000-000000000002'),  -- 돼지고기 못 먹음
  ('00000000-0000-0000-0000-000000000003');  -- 다른 모임
insert into public.foods (name, tags) values ('h_pork', array['pork']), ('h_plain', array[]::text[]);
insert into public.groups (id, name, invite_code, created_by) values
  ('10000000-0000-0000-0000-000000000001', '힌트 모임', 'TESTHN', '00000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002', '남의 모임', 'TESTHP', '00000000-0000-0000-0000-000000000003');
insert into public.memberships (group_id, user_id, display_name) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '하나'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '둘'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', '셋');
insert into public.restrictions (user_id, tag, food_id, kind) values
  ('00000000-0000-0000-0000-000000000002', 'pork', null, 'dislike');
-- 지난 판 두 개: h_plain을 두 번 먹었다
insert into public.sessions (id, group_id, host_user_id, status) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'done'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'done'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'open'),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'open');
insert into public.meals (group_id, session_id, food_id, eaten_at) values
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', (select id from public.foods where name = 'h_plain'), now() - interval '10 days'),
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', (select id from public.foods where name = 'h_plain'), now() - interval '2 days');
-- 다른 모임 기록은 세지 않는다
insert into public.sessions (id, group_id, host_user_id, status) values
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'done');
insert into public.meals (group_id, session_id, food_id) values
  ('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000005', (select id from public.foods where name = 'h_plain'));

create temp table t_h as select null::bigint food_id, null::boolean blocked, null::int eaten_count, null::timestamptz last_eaten_at limit 0;
grant all on t_h to authenticated;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select public.join_session('20000000-0000-0000-0000-000000000003');
insert into t_h select * from public.session_food_hints('20000000-0000-0000-0000-000000000003');
select throws_ok($$ select * from public.session_food_hints('20000000-0000-0000-0000-000000000004') $$,
  'P0001', 'not_member', '다른 모임 판은 못 본다');
reset role;

select is((select blocked from t_h where food_id = (select id from public.foods where name = 'h_pork')), true,
  '참여자 중 돼지고기 못 먹는 사람이 있으면 blocked');
select is((select blocked from t_h where food_id = (select id from public.foods where name = 'h_plain')), false,
  '상관없는 음식은 blocked가 아니다');
select is((select eaten_count from t_h where food_id = (select id from public.foods where name = 'h_plain')), 2,
  '이 모임 기록만 센다 (다른 모임 1번은 빼고 2번)');
select ok((select last_eaten_at from t_h where food_id = (select id from public.foods where name = 'h_plain')) > now() - interval '3 days',
  '마지막으로 먹은 때는 가장 최근 기록');
select is((select eaten_count from t_h where food_id = (select id from public.foods where name = 'h_pork')), 0,
  '안 먹은 음식은 0');

select * from finish();
rollback;
