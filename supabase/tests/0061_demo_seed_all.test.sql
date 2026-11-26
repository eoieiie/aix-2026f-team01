-- 시연 자료를 기존 사용자에게: 숨긴 예전 모임은 화면과 프로필 숫자에서 빠지고, 표에는 남고, 되돌리면 다시 보인다 (0061)
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000006101'), ('00000000-0000-0000-0000-000000006102'), ('00000000-0000-0000-0000-000000006103');
insert into public.profiles (user_id, display_name) values
  ('00000000-0000-0000-0000-000000006101', '대상'), ('00000000-0000-0000-0000-000000006102', '시연 친구'),
  ('00000000-0000-0000-0000-000000006103', '예전 친구');
insert into public.groups (id, name, invite_code, created_by, area) values
  ('10000000-0000-0000-0000-000000006101', '예전 모임', 'DMSZC6', '00000000-0000-0000-0000-000000006101', 'erica'),
  ('10000000-0000-0000-0000-000000006102', '시연 모임', 'DMSZD6', '00000000-0000-0000-0000-000000006101', 'erica');
insert into public.memberships (group_id, user_id, display_name) values
  ('10000000-0000-0000-0000-000000006101', '00000000-0000-0000-0000-000000006103', '예전'),
  ('10000000-0000-0000-0000-000000006102', '00000000-0000-0000-0000-000000006101', '대상'),
  ('10000000-0000-0000-0000-000000006102', '00000000-0000-0000-0000-000000006102', '친구');
-- 대상의 예전 모임 구성원 줄은 숨김 표로 옮겨져 있다
insert into public.demo_hidden_memberships (group_id, user_id, display_name) values
  ('10000000-0000-0000-0000-000000006101', '00000000-0000-0000-0000-000000006101', '대상');
insert into public.demo_seed (table_name, row_id, kind) values
  ('groups', '10000000-0000-0000-0000-000000006102', 'seed'), ('profiles', '00000000-0000-0000-0000-000000006102', 'seed');
insert into public.sessions (id, group_id, host_user_id, status, decided_food_id) values
  ('20000000-0000-0000-0000-000000006101', '10000000-0000-0000-0000-000000006101', '00000000-0000-0000-0000-000000006101', 'done',
   (select id from public.foods where name = '돈까스' and not custom order by id limit 1)),
  ('20000000-0000-0000-0000-000000006102', '10000000-0000-0000-0000-000000006102', '00000000-0000-0000-0000-000000006101', 'done',
   (select id from public.foods where name = '돈까스' and not custom order by id limit 1));
insert into public.meals (id, group_id, session_id, food_id, eaten_at) values
  ('30000000-0000-0000-0000-000000006101', '10000000-0000-0000-0000-000000006101', '20000000-0000-0000-0000-000000006101',
   (select id from public.foods where name = '돈까스' and not custom order by id limit 1), now() - interval '2 days'),
  ('30000000-0000-0000-0000-000000006102', '10000000-0000-0000-0000-000000006102', '20000000-0000-0000-0000-000000006102',
   (select id from public.foods where name = '돈까스' and not custom order by id limit 1), now() - interval '1 day');
insert into public.meal_participants (meal_id, user_id) values
  ('30000000-0000-0000-0000-000000006101', '00000000-0000-0000-0000-000000006101'),
  ('30000000-0000-0000-0000-000000006101', '00000000-0000-0000-0000-000000006103'),
  ('30000000-0000-0000-0000-000000006102', '00000000-0000-0000-0000-000000006101'),
  ('30000000-0000-0000-0000-000000006102', '00000000-0000-0000-0000-000000006102');

select ok(public.is_demo_user('00000000-0000-0000-0000-000000006102'), '시연용 친구(seed)도 시연 계정으로 센다');
select is((select count(*)::int from public.meals where group_id = '10000000-0000-0000-0000-000000006101'), 1, '숨긴 모임의 식사 기록은 표에 남는다');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000006101","role":"authenticated"}', true);
select throws_ok($$select count(*) from public.demo_hidden_memberships$$, '42501', null, '앱 사용자는 숨김 표를 읽지 못한다');
select is((select count(*)::int from public.groups where id = '10000000-0000-0000-0000-000000006101'), 0, '숨긴 모임은 내 화면에 안 보인다');
select is((select coalesce(sum(meal_count), 0)::int from public.my_food_counts()), 1, '내 끼니 수에 숨긴 모임의 식사가 섞이지 않는다');
select is((select meal_count from public.my_food_dex() where name = '돈까스' and not custom), 1, '도감 횟수에도 섞이지 않는다');
select is((select count(*)::int from public.my_companions() where user_id = '00000000-0000-0000-0000-000000006103'), 0, '숨긴 모임의 밥 친구는 안 보인다');
select is((select count(*)::int from public.my_companions() where user_id = '00000000-0000-0000-0000-000000006102'), 1, '시연 모임의 밥 친구는 보인다');
select is((public.meal_card('30000000-0000-0000-0000-000000006102') ->> 'my_food_nth')::int, 1, '결과 카드의 나의 N번째도 숨긴 식사를 빼고 센다');

-- 되돌리기(scripts/demo-seed-restore.sql과 같은 순서)
reset role;
insert into public.memberships (group_id, user_id, display_name, joined_at)
select h.group_id, h.user_id, h.display_name, coalesce(h.joined_at, h.hidden_at) from public.demo_hidden_memberships h
where h.was_member on conflict do nothing;
delete from public.demo_hidden_memberships h where not h.was_member;
delete from public.demo_hidden_memberships h using public.memberships m where m.group_id = h.group_id and m.user_id = h.user_id;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000006101","role":"authenticated"}', true);
select is((select count(*)::int from public.groups where id = '10000000-0000-0000-0000-000000006101'), 1, '되돌리면 예전 모임이 다시 보인다');
select is((select coalesce(sum(meal_count), 0)::int from public.my_food_counts()), 2, '되돌리면 예전 식사가 다시 센다');
select is((select count(*)::int from public.my_companions() where user_id = '00000000-0000-0000-0000-000000006103'), 1, '되돌리면 예전 밥 친구가 다시 보인다');
reset role;
select * from finish();
rollback;
