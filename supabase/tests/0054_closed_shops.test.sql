-- 폐업한 가게(카바레식당, 레이지그라운드)는 area closed로 숨고 행은 남는다 (0054)
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id) values ('00000000-0000-0000-0000-000000005401');
insert into public.profiles (user_id, display_name) values ('00000000-0000-0000-0000-000000005401', '폐업 시험');
insert into public.groups (id, name, invite_code, created_by) values
  ('10000000-0000-0000-0000-000000005401', '폐업 모임', 'CLSX54', '00000000-0000-0000-0000-000000005401');
insert into public.memberships (group_id, user_id, display_name) values
  ('10000000-0000-0000-0000-000000005401', '00000000-0000-0000-0000-000000005401', '폐업');
insert into public.sessions (id, group_id, host_user_id, status, decided_food_id) values
  ('20000000-0000-0000-0000-000000005401', '10000000-0000-0000-0000-000000005401', '00000000-0000-0000-0000-000000005401', 'done',
   (select id from public.foods where name = '카레' and not custom order by id limit 1));

select is((select count(*)::int from public.restaurants where source_id in ('node/12851077440', 'localdata/5550000-101-2018-00173')), 2,
  '두 가게 행은 지워지지 않고 남아 있다');
select is((select count(*)::int from public.restaurants where source_id in ('node/12851077440', 'localdata/5550000-101-2018-00173') and area = 'closed'), 2,
  '두 가게의 area가 closed다');
select is((select partner from public.restaurants where source_id = 'localdata/5550000-101-2018-00173'), false, '폐업한 가게의 제휴 표시가 꺼져 있다');
select is((select count(*)::int from public.council_benefits cb join public.restaurants r on r.id = cb.restaurant_id where r.area = 'closed'), 0,
  '폐업한 가게에 걸린 학생회 제휴 연결이 없다');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000005401","role":"authenticated"}', true);
select is((select count(*)::int from public.shop_list() where name in ('카바레식당', '레이지그라운드')), 0, '가게 목록에 두 가게가 없다');
select is((select count(*)::int from public.shop_list() where id in (select id from public.restaurants where area = 'closed')), 0, '가게 목록에 closed 가게가 하나도 없다');
select is((select count(*)::int from public.session_restaurants('20000000-0000-0000-0000-000000005401') where name in ('카바레식당', '레이지그라운드')), 0, '결과 식당 목록에 두 가게가 없다');
select is((select count(*)::int from public.session_cafes('20000000-0000-0000-0000-000000005401') where name in ('카바레식당', '레이지그라운드')), 0, '결과 카페 목록에 두 가게가 없다');
reset role;

select * from finish();
rollback;
