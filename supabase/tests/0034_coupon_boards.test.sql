-- 쿠폰 현황판: 운영자와 사장님 (명세 4-28, 0034)
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000003401'),  -- 운영자
  ('00000000-0000-0000-0000-000000003402'),  -- 손님
  ('00000000-0000-0000-0000-000000003403');  -- 손님
insert into public.profiles (user_id, display_name) values
  ('00000000-0000-0000-0000-000000003401', '운영'),
  ('00000000-0000-0000-0000-000000003402', '손님하나'),
  ('00000000-0000-0000-0000-000000003403', '손님둘');
insert into public.app_admins (user_id, note) values ('00000000-0000-0000-0000-000000003401', '시험');
insert into public.foods (name, tags, cuisine) values ('b국수', array[]::text[], 'korean');
insert into public.restaurants (area, name, cuisine, menus, partner, coupon_text, source_id) values
  ('b_test', '현황 집', 'korean', '{}', true, '음료 한 캔', 'b/1'),
  ('b_test', '옆 집', 'korean', '{}', true, '500원 할인', 'b/2'),
  ('zz_board', '예시 집', 'korean', '{}', true, '예시', 'b/3');
insert into public.shop_private (restaurant_id, staff_pin, owner_token) values
  ((select id from public.restaurants where source_id = 'b/1'), null, repeat('b', 40)),
  ((select id from public.restaurants where source_id = 'b/2'), null, repeat('c', 40));
insert into public.groups (id, name, invite_code, created_by, area) values
  ('10000000-0000-0000-0000-000000003401', '현황 모임', 'TESTB1', '00000000-0000-0000-0000-000000003402', 'b_test');
insert into public.memberships (group_id, user_id, display_name) values
  ('10000000-0000-0000-0000-000000003401', '00000000-0000-0000-0000-000000003402', '손님하나'),
  ('10000000-0000-0000-0000-000000003401', '00000000-0000-0000-0000-000000003403', '손님둘');
insert into public.sessions (id, group_id, host_user_id, status, decided_food_id) values
  ('20000000-0000-0000-0000-000000003401', '10000000-0000-0000-0000-000000003401', '00000000-0000-0000-0000-000000003402', 'done',
   (select id from public.foods where name = 'b국수'));
-- 한 판에서 두 사람이 받았다(한 팀, 3명이 감, 씀). 가게 화면에서 한 장(한 팀, 안 씀). 옆 집 한 장. 예시 동네 한 장
insert into public.coupon_claims (restaurant_id, session_id, user_id, code, source, claim_day, benefit, party_size, claimed_at, redeemed_at) values
  ((select id from public.restaurants where source_id = 'b/1'), '20000000-0000-0000-0000-000000003401', '00000000-0000-0000-0000-000000003402', 'AAAAAA', 'session', current_date, '음료 한 캔', 3, now() - interval '2 hours', now() - interval '1 hour'),
  ((select id from public.restaurants where source_id = 'b/1'), '20000000-0000-0000-0000-000000003401', '00000000-0000-0000-0000-000000003403', 'AAAAAA', 'session', current_date, '음료 한 캔', 3, now() - interval '2 hours', now() - interval '1 hour'),
  ((select id from public.restaurants where source_id = 'b/1'), null, '00000000-0000-0000-0000-000000003403', 'BBBBBB', 'shop', current_date, '음료 한 캔', 1, now() - interval '30 minutes', null),
  ((select id from public.restaurants where source_id = 'b/2'), null, '00000000-0000-0000-0000-000000003402', 'CCCCCC', 'shop', current_date, '500원 할인', 1, now() - interval '10 minutes', null),
  ((select id from public.restaurants where source_id = 'b/3'), null, '00000000-0000-0000-0000-000000003402', 'DDDDDD', 'shop', current_date, '예시', 1, now() - interval '5 minutes', null);

create temp table t_b (k text primary key, d jsonb);
grant all on t_b to authenticated, anon;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000003402","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select public.admin_coupon_board() $$, 'P0001', 'not_admin', '운영자가 아니면 현황판을 볼 수 없다');
select throws_ok($$ select * from public.app_admins $$, '42501', null, '운영자 목록은 읽을 수 없다');
select is(public.is_app_admin(), false, '운영자가 아니다');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000003401","role":"authenticated"}', true);
set local role authenticated;
insert into t_b select 'area', public.admin_coupon_board(30, 'b_test');
insert into t_b select 'all', public.admin_coupon_board(30);
reset role;

select is((select d -> 'totals' from t_b where k = 'area'),
  '{"claimed": 3, "redeemed": 1, "people": 3, "shops": 2}'::jsonb,
  '팀으로 센다: 한 판에서 둘이 받아도 한 팀, 쓴 팀의 인원 합');
select is((select d #>> '{shops,0,name}' from t_b where k = 'area'), '현황 집', '가게별 줄은 많이 쓴 가게가 먼저');
select is((select (d #>> '{shops,0,claimed}')::int from t_b where k = 'area'), 2, '가게별 받은 팀');
select is((select d #>> '{recent,2,names}' from t_b where k = 'area'), '손님둘, 손님하나', '운영자 화면에는 이름이 보인다');
select is((select d #>> '{recent,2,menu}' from t_b where k = 'area'), 'b국수', '판에서 받은 쿠폰은 메뉴가 같이 온다');
select is((select jsonb_array_length(d -> 'hour_claimed') from t_b where k = 'area'), 24, '시간대 24칸');
select ok(not exists (select 1 from t_b, jsonb_array_elements(d -> 'shops') x where k = 'all' and x ->> 'name' = '예시 집'),
  '동네를 비우면 zz로 시작하는 예시 동네는 빠진다');

-- 사장님: 로그인 없이(anon) 토큰으로 자기 가게만
set local role anon;
insert into t_b select 'owner', public.owner_board(repeat('b', 40));
select throws_ok($$ select public.owner_board(repeat('x', 40)) $$, 'P0001', 'not_found', '틀린 토큰은 not_found');
select throws_ok($$ select public.owner_board('short') $$, 'P0001', 'not_found', '짧은 토큰은 not_found');
reset role;

select is((select d -> 'total' from t_b where k = 'owner'), '{"claimed": 2, "redeemed": 1, "people": 3}'::jsonb,
  '사장님은 자기 가게 숫자만 본다(옆 집 쿠폰은 세지 않는다)');
select is((select d #>> '{shop,name}' from t_b where k = 'owner'), '현황 집', '토큰의 가게');
select ok((select d::text !~ '손님' from t_b where k = 'owner'), '사장님 화면에는 이름이 나가지 않는다');
select is((select d -> 'menus' from t_b where k = 'owner'), 'null'::jsonb, '5팀이 안 되면 메뉴와 시간대 분포를 주지 않는다');

select * from finish();
rollback;
