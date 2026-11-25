-- 운영자 현황판의 단과대별 쓴 쿠폰 (명세 4-28, 0035)
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

-- 운영자 1명, 손님 7명(소프트웨어융합대학 5명, 공학대학 1명, 고르지 않음 1명)
insert into auth.users (id)
select ('00000000-0000-0000-0000-0000000035' || lpad(n::text, 2, '0'))::uuid from generate_series(0, 7) n;
insert into public.profiles (user_id, display_name)
select ('00000000-0000-0000-0000-0000000035' || lpad(n::text, 2, '0'))::uuid, '손님' || n from generate_series(0, 7) n;
update public.profiles set college = 'computing'
where user_id in (select ('00000000-0000-0000-0000-0000000035' || lpad(n::text, 2, '0'))::uuid from generate_series(1, 5) n);
update public.profiles set college = 'eng' where user_id = '00000000-0000-0000-0000-000000003506';
insert into public.app_admins (user_id) values ('00000000-0000-0000-0000-000000003500');
insert into public.restaurants (area, name, cuisine, menus, partner, coupon_text, source_id) values
  ('k_test', '단과대 집', 'korean', '{}', true, '음료', 'k/1');
-- 손님마다 가게 화면 쿠폰 1장, 모두 썼다
insert into public.coupon_claims (restaurant_id, user_id, code, source, claim_day, party_size, redeemed_at)
select (select id from public.restaurants where source_id = 'k/1'),
  ('00000000-0000-0000-0000-0000000035' || lpad(n::text, 2, '0'))::uuid, 'K' || n, 'shop', current_date, 1, now()
from generate_series(1, 7) n;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000003501","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select * from public.admin_coupon_colleges(30, 'k_test') $$, 'P0001', 'not_admin', '운영자가 아니면 단과대 합계를 볼 수 없다');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000003500","role":"authenticated"}', true);
set local role authenticated;
select is((select redeemed from public.admin_coupon_colleges(30, 'k_test') where college = 'computing'), 5, '5명 이상인 단과대는 따로 센다');
select is((select users from public.admin_coupon_colleges(30, 'k_test') where college = 'other'), 2, '5명 미만인 단과대와 고르지 않은 사람은 기타로 묶는다');
select is((select count(*)::int from public.admin_coupon_colleges(30, 'k_test') where college = 'eng'), 0, '5명 미만인 단과대 이름은 나가지 않는다');
reset role;

select * from finish();
rollback;
