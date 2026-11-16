-- 결과 뒤 학교 앞 식당, 제휴 광고와 쿠폰 (명세 4-21, 0015)
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000000001'),  -- 방장
  ('00000000-0000-0000-0000-000000000002'),  -- 친구
  ('00000000-0000-0000-0000-000000000003');  -- 다른 모임
insert into public.foods (name, tags, cuisine) values ('r국수', array[]::text[], 'korean'), ('r파스타', array[]::text[], 'western');
-- 시험용 동네(r_test)라 seed의 ERICA 식당과 섞이지 않는다
insert into public.restaurants (area, name, cuisine, menus, partner, coupon_text, source_id) values
  ('r_test', '할매 r국수', 'korean', '{}', false, null, 't/1'),
  ('r_test', '대표메뉴집', 'chinese', '{r국수}', false, null, 't/2'),
  ('r_test', '한식당 하나', 'korean', '{}', false, null, 't/3'),
  ('r_test', '한식당 제휴', 'korean', '{}', true, '밥BTI 보여 주면 음료 1개', 't/4'),
  ('r_test', '한식당 셋', 'korean', '{}', false, '안 보여야 하는 문구', 't/5'),
  ('r_test', '양식당', 'western', '{}', true, '쿠폰', 't/6'),
  ('erica_other', '다른 동네 r국수', 'korean', '{}', true, '쿠폰', 't/7');
insert into public.groups (id, name, invite_code, created_by, area) values
  ('10000000-0000-0000-0000-000000000001', '식당 모임', 'TESTRS', '00000000-0000-0000-0000-000000000001', 'r_test'),
  ('10000000-0000-0000-0000-000000000002', '남의 모임', 'TESTRT', '00000000-0000-0000-0000-000000000003', 'r_test');
insert into public.memberships (group_id, user_id, display_name) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '하나'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '둘'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', '셋');
insert into public.sessions (id, group_id, host_user_id, status, decided_food_id) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'done',
   (select id from public.foods where name = 'r국수')),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'open', null);

create temp table t_r as select * from public.session_restaurants('20000000-0000-0000-0000-000000000001') limit 0;
grant all on t_r to authenticated;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
insert into t_r select * from public.session_restaurants('20000000-0000-0000-0000-000000000001');
select is((select count(*)::int from public.session_restaurants('20000000-0000-0000-0000-000000000002')), 0,
  '끝나지 않은 판에 후보가 없으면 식당이 없다 (0016부터 not_done 대신 0행)');
select throws_ok($$ select public.claim_coupon('20000000-0000-0000-0000-000000000001',
  (select id from public.restaurants where source_id = 't/3')) $$,
  'P0001', 'not_partner', '제휴가 아닌 식당은 쿠폰이 없다');
select is(
  public.claim_coupon('20000000-0000-0000-0000-000000000001', (select id from public.restaurants where source_id = 't/4')),
  public.coupon_code('20000000-0000-0000-0000-000000000001', (select id from public.restaurants where source_id = 't/4')),
  '제휴 식당 쿠폰을 받으면 판마다 같은 코드');
select public.claim_coupon('20000000-0000-0000-0000-000000000001', (select id from public.restaurants where source_id = 't/4'));
select is((select count(*)::int from public.coupon_claims), 1, '다시 눌러도 한 번만 남고, 내 기록만 보인다');
select throws_ok($$ insert into public.coupon_claims (restaurant_id, session_id, user_id, code)
  values (1, '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'X') $$,
  '42501', null, '쿠폰 기록은 직접 쓸 수 없다');
select is((select my_code from public.session_restaurants('20000000-0000-0000-0000-000000000001') where name = '한식당 제휴'),
  public.coupon_code('20000000-0000-0000-0000-000000000001', (select id from public.restaurants where source_id = 't/4')),
  '받은 코드는 식당 목록에 같이 온다');
reset role;

select is((select count(*)::int from t_r), 3, '최대 3곳');
select is((select array_agg(name order by name) from (select name from t_r where match = 'menu') x),
  array['대표메뉴집', '할매 r국수'], '가게 이름이나 대표 메뉴에 음식 이름이 있으면 메뉴가 맞는 곳');
select is((select name from t_r where match = 'cuisine'), '한식당 제휴', '메뉴가 맞는 곳 다음은 같은 종류, 같은 조건이면 제휴가 위로');
select is((select coupon_text from t_r where name = '한식당 제휴'), '밥BTI 보여 주면 음료 1개', '제휴 식당은 쿠폰 문구가 온다');
select ok(not exists (select 1 from t_r where name in ('양식당', '다른 동네 r국수')), '다른 종류, 다른 동네 식당은 안 나온다');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select * from public.session_restaurants('20000000-0000-0000-0000-000000000001') $$,
  'P0001', 'not_member', '다른 모임 판은 못 본다');
select is((select count(*)::int from public.coupon_claims), 0, '남의 쿠폰 기록은 안 보인다');
reset role;

select * from finish();
rollback;
