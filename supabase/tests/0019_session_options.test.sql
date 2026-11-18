-- 방장 옵션 (명세 4-6, 4-11, 0019): 인당 표 수, 한 메뉴에 여러 표, 룰렛 무게
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002');
insert into public.foods (name, tags) values ('t옵1', array[]::text[]), ('t옵2', array[]::text[]), ('t옵3', array[]::text[]);
insert into public.groups (id, name, invite_code, created_by) values
  ('10000000-0000-0000-0000-000000000001', '옵션 하나', 'TESTPA', '00000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002', '옵션 둘', 'TESTPB', '00000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000003', '옵션 셋', 'TESTPC', '00000000-0000-0000-0000-000000000001');
insert into public.memberships (group_id, user_id, display_name)
select g, '00000000-0000-0000-0000-000000000001', '하나'
from unnest(array['10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003']::uuid[]) as g;

create temp table t_s (k text, id uuid);
grant all on t_s to authenticated;
create function pg_temp.f(p text) returns bigint language sql as $$ select id from public.foods where name = p $$;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

-- 옛 호출(모임, 인원수)은 기본값 2표, 여러 표 끔
insert into t_s select 'old', public.start_session('10000000-0000-0000-0000-000000000003', 1);
select is((select vote_limit from public.sessions where id = (select id from t_s where k = 'old')), 2, '옛 호출은 인당 2표');
select is((select allow_repeat from public.sessions where id = (select id from t_s where k = 'old')), false, '옛 호출은 여러 표 끔');

select throws_ok($$ select public.start_session('10000000-0000-0000-0000-000000000001', 1, 4, false) $$,
  'P0001', 'bad_vote_limit', '인당 4표는 거절');

-- 인당 1표
insert into t_s select 'one', public.start_session('10000000-0000-0000-0000-000000000001', 1, 1, false);
select public.join_session((select id from t_s where k = 'one'));
select public.add_candidate((select id from t_s where k = 'one'), pg_temp.f(n)) from unnest(array['t옵1', 't옵2']) n;
select public.open_voting((select id from t_s where k = 'one'));
select is(public.cast_vote((select id from t_s where k = 'one'), pg_temp.f('t옵1')), true, '1표 판: 첫 표는 들어간다');
select throws_ok($$ select public.cast_vote((select id from t_s where k = 'one'), pg_temp.f('t옵2')) $$,
  'P0001', 'vote_limit', '1표 판: 두 번째 메뉴는 막힌다');
select is(public.cast_vote((select id from t_s where k = 'one'), pg_temp.f('t옵1')), false,
  '여러 표가 꺼진 판: 같은 메뉴를 다시 누르면 취소');

-- 인당 3표, 한 메뉴에 여러 표
insert into t_s select 'rep', public.start_session('10000000-0000-0000-0000-000000000002', 1, 3, true);
select public.join_session((select id from t_s where k = 'rep'));
select public.add_candidate((select id from t_s where k = 'rep'), pg_temp.f(n)) from unnest(array['t옵1', 't옵2', 't옵3']) n;
select public.open_voting((select id from t_s where k = 'rep'));
select public.cast_vote((select id from t_s where k = 'rep'), pg_temp.f('t옵1'));
select is(public.cast_vote((select id from t_s where k = 'rep'), pg_temp.f('t옵1')), true, '여러 표 판: 같은 메뉴에 한 표 더');
select is((select weight from public.votes where session_id = (select id from t_s where k = 'rep') and food_id = pg_temp.f('t옵1')),
  2, '한 메뉴에 2표가 쌓인다');
select public.cast_vote((select id from t_s where k = 'rep'), pg_temp.f('t옵2'));
select throws_ok($$ select public.cast_vote((select id from t_s where k = 'rep'), pg_temp.f('t옵3')) $$,
  'P0001', 'vote_limit', '3표를 다 쓰면 새 메뉴는 막힌다');
select is(public.cast_vote((select id from t_s where k = 'rep'), pg_temp.f('t옵1')), false,
  '표를 다 쓴 뒤 2표 준 메뉴를 누르면 그 메뉴 표를 모두 거둔다');
select is((select coalesce(sum(weight), 0)::int from public.votes where session_id = (select id from t_s where k = 'rep')),
  1, '남은 표는 t옵2 하나');

-- 룰렛은 weight로 센다: 남은 표가 t옵2뿐이면 t옵2가 뽑힌다
select public.cast_vote((select id from t_s where k = 'rep'), pg_temp.f('t옵2'));
select public.spin_roulette((select id from t_s where k = 'rep'));
select is((select decided_food_id from public.sessions where id = (select id from t_s where k = 'rep')),
  pg_temp.f('t옵2'), '룰렛 무게는 표 수의 합. 표가 있는 메뉴만 나온다');
reset role;

select * from finish();
rollback;
