-- 쿠폰 받는 길 둘, 쿠폰함, 직원 확인 (명세 4-27, 0033)
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000003301'),  -- 방장
  ('00000000-0000-0000-0000-000000003302'),  -- 같은 판 친구
  ('00000000-0000-0000-0000-000000003303');  -- 남
insert into public.foods (name, tags, cuisine) values ('c국수', array[]::text[], 'korean');
insert into public.restaurants (area, name, cuisine, menus, partner, coupon_text, source_id) values
  ('c_test', '비밀번호 있는 집', 'korean', '{c국수}', true, '음료 한 캔', 'c/1'),
  ('c_test', '비밀번호 없는 집', 'korean', '{}', true, '500원 할인', 'c/2'),
  ('c_test', '제휴 아닌 집', 'korean', '{}', false, null, 'c/3'),
  ('c_test', '혜택이 빈 제휴 집', 'korean', '{}', true, null, 'c/4');
insert into public.shop_private (restaurant_id, staff_pin, owner_token) values
  ((select id from public.restaurants where source_id = 'c/1'), '4821', repeat('a', 40));
insert into public.groups (id, name, invite_code, created_by, area) values
  ('10000000-0000-0000-0000-000000003301', '쿠폰 모임', 'TESTC2', '00000000-0000-0000-0000-000000003301', 'c_test');
insert into public.memberships (group_id, user_id, display_name) values
  ('10000000-0000-0000-0000-000000003301', '00000000-0000-0000-0000-000000003301', '하나'),
  ('10000000-0000-0000-0000-000000003301', '00000000-0000-0000-0000-000000003302', '둘');
insert into public.sessions (id, group_id, host_user_id, status, decided_food_id) values
  ('20000000-0000-0000-0000-000000003301', '10000000-0000-0000-0000-000000003301', '00000000-0000-0000-0000-000000003301', 'done',
   (select id from public.foods where name = 'c국수'));
insert into public.session_participants (session_id, user_id) values
  ('20000000-0000-0000-0000-000000003301', '00000000-0000-0000-0000-000000003301'),
  ('20000000-0000-0000-0000-000000003301', '00000000-0000-0000-0000-000000003302');

create temp table t_ids (k text primary key, id uuid);
grant all on t_ids to authenticated;

-- 방장: 판 결과에서 받고, 가게 화면에서도 받는다
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000003301","role":"authenticated"}', true);
set local role authenticated;
select public.claim_coupon('20000000-0000-0000-0000-000000003301', (select id from public.restaurants where source_id = 'c/1'));
insert into t_ids select 'host_session', id from public.my_coupons() where source = 'session';
select is((select party_size from public.coupon_claims where source = 'session'), 2, '판에서 받으면 그 판에 들어온 사람 수가 남는다');
select is((select benefit from public.my_coupons() where source = 'session'), '음료 한 캔', '받을 때의 혜택이 쿠폰에 남는다');
select ok((select pin_required from public.my_coupons() where source = 'session'), '비밀번호가 있는 가게 쿠폰은 pin_required');

insert into t_ids select 'host_shop', public.claim_shop_coupon((select id from public.restaurants where source_id = 'c/2'));
select is(public.claim_shop_coupon((select id from public.restaurants where source_id = 'c/2')), (select id from t_ids where k = 'host_shop'),
  '가게 화면에서 같은 날 다시 받으면 같은 쿠폰이다');
select is((select count(*)::int from public.coupon_claims where source = 'shop'), 1, '한 가게에서 하루 1장');
select throws_ok($$ select public.claim_shop_coupon((select id from public.restaurants where source_id = 'c/3')) $$,
  'P0001', 'not_partner', '제휴가 아닌 가게는 쿠폰이 없다');
select throws_ok($$ select public.claim_shop_coupon((select id from public.restaurants where source_id = 'c/4')) $$,
  'P0001', 'not_partner', '혜택을 정하지 않은 제휴 가게는 쿠폰이 없다');
select throws_ok($$ select * from public.shop_private $$, '42501', null, '가게 비밀번호와 사장님 토큰은 읽을 수 없다');
select throws_ok($$ update public.coupon_claims set redeemed_at = now() $$, '42501', null, '쿠폰 기록은 직접 고칠 수 없다');
reset role;

-- 친구: 같은 판 쿠폰을 받는다(같은 코드). 방장 쿠폰은 못 쓴다
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000003302","role":"authenticated"}', true);
set local role authenticated;
select public.claim_coupon('20000000-0000-0000-0000-000000003301', (select id from public.restaurants where source_id = 'c/1'));
insert into t_ids select 'friend_session', id from public.my_coupons() where source = 'session';
select throws_ok($$ select public.redeem_coupon((select id from t_ids where k = 'host_session'), '4821') $$,
  'P0001', 'not_yours', '남의 쿠폰은 쓸 수 없다');
select is(public.redeem_coupon((select id from t_ids where k = 'friend_session'), '0000') ->> 'reason', 'wrong_pin',
  '가게 비밀번호가 틀리면 거절한다');
select is((select redeemed_at from public.my_coupons() where source = 'session'), null::timestamptz, '틀리면 쓴 것으로 남지 않는다');
select is((select tries_left from public.my_coupons() where source = 'session'), 4, '틀린 횟수가 남는다');
select is(public.redeem_coupon((select id from t_ids where k = 'friend_session'), null) ->> 'ok', 'false', '비밀번호 없이도 거절한다');
select is(public.redeem_coupon((select id from t_ids where k = 'friend_session'), '4821') ->> 'ok', 'true', '맞으면 쓴 것으로 남는다');
select throws_ok($$ select public.redeem_coupon((select id from t_ids where k = 'friend_session'), '4821') $$,
  'P0001', 'already_used', '두 번 쓸 수 없다');
reset role;

-- 방장: 친구가 확인했으니 같은 판의 내 쿠폰도 쓴 것이다. 비밀번호 없는 가게는 확인만으로 쓴다
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000003301","role":"authenticated"}', true);
set local role authenticated;
select ok((select redeemed_at is not null from public.my_coupons() where source = 'session'), '한 팀에 하나: 한 사람이 확인하면 같은 판 쿠폰이 모두 쓴 것이 된다');
select throws_ok($$ select public.redeem_coupon((select id from t_ids where k = 'host_session'), '4821') $$,
  'P0001', 'already_used', '같은 팀 쿠폰을 다시 쓸 수 없다');
select is(public.redeem_coupon((select id from t_ids where k = 'host_shop')) ->> 'ok', 'true', '비밀번호가 없는 가게는 확인 한 번으로 쓴다');
reset role;

-- 지난 쿠폰과 잠긴 쿠폰
update public.coupon_claims set redeemed_at = null, claimed_at = now() - interval '25 hours' where id = (select id from t_ids where k = 'host_shop');
update public.coupon_claims set redeemed_at = null, pin_fails = 5 where id = (select id from t_ids where k = 'host_session');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000003301","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select public.redeem_coupon((select id from t_ids where k = 'host_shop')) $$,
  'P0001', 'expired', '받은 지 24시간이 지난 쿠폰은 쓸 수 없다');
select is(public.redeem_coupon((select id from t_ids where k = 'host_session'), '4821') ->> 'reason', 'locked',
  '비밀번호를 5번 틀린 쿠폰은 맞게 넣어도 잠겨 있다');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000003303","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.my_coupons()), 0, '남의 쿠폰은 쿠폰함에 안 보인다');
reset role;

select * from finish();
rollback;
