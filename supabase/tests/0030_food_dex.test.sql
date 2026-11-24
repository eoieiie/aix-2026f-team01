-- 음식 도감과 모임 타임라인 (0030, 명세 4-25)
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000a2'), ('00000000-0000-0000-0000-0000000000a3');
insert into public.foods (name, tags, custom) values ('dex_직접', array[]::text[], true), ('dex_남의직접', array[]::text[], true);
insert into public.groups (id, name, invite_code, created_by) values
  ('10000000-0000-0000-0000-0000000000a1', '도감 모임', 'DEXABC', '00000000-0000-0000-0000-0000000000a1');
insert into public.memberships (group_id, user_id, display_name) values
  ('10000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1', '하나'),
  ('10000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2', '둘');
insert into public.sessions (id, group_id, host_user_id, status)
select ('20000000-0000-0000-0000-0000000000a' || n)::uuid, '10000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1', 'done'
from generate_series(1, 3) n;
insert into public.meals (id, group_id, session_id, food_id, eaten_at) values
  ('30000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-0000000000a1', (select id from public.foods where name = '짜장면'), '2026-11-01 12:00+09'),
  ('30000000-0000-0000-0000-0000000000a2', '10000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-0000000000a2', (select id from public.foods where name = '짜장면'), '2026-11-05 12:00+09'),
  ('30000000-0000-0000-0000-0000000000a3', '10000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-0000000000a3', (select id from public.foods where name = 'dex_직접'), '2026-11-06 12:00+09');
insert into public.meal_participants (meal_id, user_id) values
  ('30000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1'),
  ('30000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2'),
  ('30000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a1'),
  ('30000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000a1');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*)::int from public.my_food_dex() where not custom), (select count(*)::int from public.foods where not custom), '기본 메뉴는 안 먹었어도 모두 나온다');
select is((select meal_count from public.my_food_dex() where name = '짜장면'), 2, '짜장면 두 번');
select is((select companion_count from public.my_food_dex() where name = '짜장면'), 1, '짜장면을 같이 먹은 사람 1명(나는 빼고)');
select is((select first_eaten from public.my_food_dex() where name = '짜장면'), '2026-11-01 12:00+09'::timestamptz, '처음 먹은 날');
select is((select count(*)::int from public.my_food_dex() where custom), 1, '직접 적은 메뉴는 내가 먹은 것만');
select is((select count(*)::int from public.group_meal_timeline('10000000-0000-0000-0000-0000000000a1')), 3, '모임 끼니 3개');
select is((select eaters from public.group_meal_timeline('10000000-0000-0000-0000-0000000000a1') where eaten_at = '2026-11-01 12:00+09'), array['둘','하나'], '함께 먹은 사람 이름');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
select throws_ok($$ select * from public.group_meal_timeline('10000000-0000-0000-0000-0000000000a1') $$, 'not_member', '멤버가 아니면 못 본다');

select * from finish();
rollback;
