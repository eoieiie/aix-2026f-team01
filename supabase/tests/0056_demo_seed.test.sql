-- 시연 자료 표시: 예시 가게는 표시된 모임 구성원에게만 보이고, 그 모임의 쿠폰은 실측 숫자에서 빠진다 (0056)
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000005601'), ('00000000-0000-0000-0000-000000005602'), ('00000000-0000-0000-0000-000000005603');
insert into public.profiles (user_id, display_name) values
  ('00000000-0000-0000-0000-000000005601', '시연 팀장'), ('00000000-0000-0000-0000-000000005602', '시연 인물'),
  ('00000000-0000-0000-0000-000000005603', '바깥 사람');
-- 예시 가게(zz_test)와 실제 동네의 제휴 가게
insert into public.restaurants (id, area, name, cuisine, menus, lat, lng, partner, coupon_text)
overriding system value values
  (995601, 'zz_test', 'zz_시연 분식', 'korean', array['떡볶이'], 37.2992, 126.8378, true, '튀김 한 접시'),
  (995602, 'erica', 'zz_시연 떡볶이집', 'korean', array['떡볶이'], 37.2993, 126.8377, true, '음료 하나');
insert into public.shop_private (restaurant_id, staff_pin, owner_token)
values (995602, null, 'zz_demo_owner_token_0056_aaaaaaaaaaaaaaaa');
insert into public.groups (id, name, invite_code, created_by, area) values
  ('10000000-0000-0000-0000-000000005601', '시연 모임', 'DMSZA6', '00000000-0000-0000-0000-000000005602', 'erica'),
  ('10000000-0000-0000-0000-000000005602', '보통 모임', 'DMSZB6', '00000000-0000-0000-0000-000000005603', 'erica');
insert into public.memberships (group_id, user_id, display_name) values
  ('10000000-0000-0000-0000-000000005601', '00000000-0000-0000-0000-000000005601', '팀장'),
  ('10000000-0000-0000-0000-000000005601', '00000000-0000-0000-0000-000000005602', '인물'),
  ('10000000-0000-0000-0000-000000005602', '00000000-0000-0000-0000-000000005603', '바깥');
insert into public.sessions (id, group_id, host_user_id, status, decided_food_id) values
  ('20000000-0000-0000-0000-000000005601', '10000000-0000-0000-0000-000000005601', '00000000-0000-0000-0000-000000005601', 'done',
   (select id from public.foods where name = '떡볶이' and not custom order by id limit 1)),
  ('20000000-0000-0000-0000-000000005602', '10000000-0000-0000-0000-000000005602', '00000000-0000-0000-0000-000000005603', 'done',
   (select id from public.foods where name = '떡볶이' and not custom order by id limit 1));
insert into public.session_participants (session_id, user_id, voted) values
  ('20000000-0000-0000-0000-000000005601', '00000000-0000-0000-0000-000000005601', true),
  ('20000000-0000-0000-0000-000000005601', '00000000-0000-0000-0000-000000005602', true),
  ('20000000-0000-0000-0000-000000005602', '00000000-0000-0000-0000-000000005603', true);
insert into public.demo_seed (table_name, row_id, kind) values
  ('groups', '10000000-0000-0000-0000-000000005601', 'seed'),
  ('profiles', '00000000-0000-0000-0000-000000005602', 'mark'),
  ('restaurants', '995601', 'mark');
insert into public.app_admins (user_id) values ('00000000-0000-0000-0000-000000005601');

select ok(public.is_demo_claim('20000000-0000-0000-0000-000000005601', '00000000-0000-0000-0000-000000005601'), '표시된 모임의 판에서 받은 쿠폰은 시연 자료다');
select ok(not public.is_demo_claim('20000000-0000-0000-0000-000000005602', '00000000-0000-0000-0000-000000005603'), '보통 모임의 쿠폰은 시연 자료가 아니다');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000005601","role":"authenticated"}', true);
select throws_ok($$select count(*) from public.demo_seed$$, '42501', null, '앱 사용자는 표시 표를 읽지 못한다');
select is((select count(*)::int from public.shop_list() where id = 995601), 1, '표시된 모임 구성원의 가게 목록에 예시 가게가 있다');
select is((select count(*)::int from public.session_restaurants('20000000-0000-0000-0000-000000005601') where id = 995601), 1,
  '표시된 모임의 판 결과에 예시 가게가 있다');
select isnt(public.claim_coupon('20000000-0000-0000-0000-000000005601', 995601), null, '표시된 모임의 판에서 예시 가게 쿠폰을 받는다');
select isnt(public.claim_coupon('20000000-0000-0000-0000-000000005601', 995602), null, '표시된 모임의 판에서 실제 동네 가게 쿠폰을 받는다');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000005603","role":"authenticated"}', true);
select is((select count(*)::int from public.shop_list() where id = 995601), 0, '다른 사용자의 가게 목록에는 예시 가게가 없다');
select is((select count(*)::int from public.session_restaurants('20000000-0000-0000-0000-000000005602') where id = 995601), 0,
  '보통 모임의 판 결과에는 예시 가게가 없다');
select throws_ok($$select public.claim_coupon('20000000-0000-0000-0000-000000005602', 995601)$$, 'P0001', 'not_partner',
  '보통 모임의 판에서는 예시 가게 쿠폰을 받지 못한다');
select isnt(public.claim_coupon('20000000-0000-0000-0000-000000005602', 995602), null, '보통 모임은 실제 가게 쿠폰을 받는다');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000005601","role":"authenticated"}', true);
select is((select (x ->> 'claimed')::int from jsonb_array_elements(public.admin_coupon_board(30, null) -> 'shops') x where (x ->> 'id')::bigint = 995602), 1,
  '운영자 현황판의 실제 가게 줄에는 시연 모임 쿠폰이 빠진다');
reset role;
select is((public.owner_board('zz_demo_owner_token_0056_aaaaaaaaaaaaaaaa') -> 'week' ->> 'claimed')::int, 1,
  '사장님 현황판에도 시연 모임 쿠폰이 빠진다');
select * from finish();
rollback;
