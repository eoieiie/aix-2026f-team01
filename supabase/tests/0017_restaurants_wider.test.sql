-- 식당 서버 넓히기: 투표 단계, 걸어서 몇 분, 영업 중, 간 모임 수, 사진 칸 (명세 4-21, 0016)
begin;
create extension if not exists pgtap with schema extensions;
select plan(37);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000000001'),  -- 방장
  ('00000000-0000-0000-0000-000000000002'),  -- 친구
  ('00000000-0000-0000-0000-000000000003');  -- 다른 모임
insert into public.foods (name, tags, cuisine) values
  ('w국수', array[]::text[], 'korean'), ('w파스타', array[]::text[], 'western'), ('w커리', array[]::text[], 'asian');
-- 시험용 동네(w_test)라 seed의 ERICA 식당과 섞이지 않는다. 정문 좌표가 없는 동네다
insert into public.restaurants (area, name, cuisine, menus, partner, coupon_text, opening_hours, source_id) values
  ('w_test', '할매 w국수', 'korean', '{}', false, null, null, 'w/1'),
  ('w_test', '대표메뉴집', 'chinese', '{w파스타}', false, null, null, 'w/2'),
  ('w_test', '한식당 제휴', 'korean', '{}', true, '밥BTI 보여 주면 음료 1개', '24/7', 'w/3'),
  ('w_test', '양식당 제휴', 'western', '{}', true, '쿠폰', '예약제', 'w/4'),
  ('w_test', '한식당 하나', 'korean', '{}', false, null, null, 'w/5'),
  ('w_test', '한식당 둘', 'korean', '{}', false, null, null, 'w/6'),
  ('w_test', '양식당 하나', 'western', '{}', false, null, null, 'w/7'),
  ('w_test', '일식당', 'japanese', '{}', false, null, null, 'w/8');
insert into public.groups (id, name, invite_code, created_by, area) values
  ('10000000-0000-0000-0000-000000000001', '식당 모임', 'TESTWA', '00000000-0000-0000-0000-000000000001', 'w_test'),
  ('10000000-0000-0000-0000-000000000002', '남의 모임', 'TESTWB', '00000000-0000-0000-0000-000000000003', 'w_test'),
  -- 진행 중인 판은 모임마다 하나라, 후보 없는 판은 다른 모임에 둔다
  ('10000000-0000-0000-0000-000000000003', '빈 판 모임', 'TESTWC', '00000000-0000-0000-0000-000000000001', 'w_test');
insert into public.memberships (group_id, user_id, display_name) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '하나'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '둘'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', '셋'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', '둘');
insert into public.sessions (id, group_id, host_user_id, status, decided_food_id) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'voting', null),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'open', null),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'done',
   (select id from public.foods where name = 'w국수')),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'done',
   (select id from public.foods where name = 'w국수'));
-- 투표 중인 판의 후보: w파스타가 먼저, w국수는 못 먹는 사람이 있는 후보(그래도 기준에 들어간다)
insert into public.candidates (session_id, food_id, proposed_by, vetoed, created_at) values
  ('20000000-0000-0000-0000-000000000001', (select id from public.foods where name = 'w파스타'),
   '00000000-0000-0000-0000-000000000001', false, now() - interval '2 minutes'),
  ('20000000-0000-0000-0000-000000000001', (select id from public.foods where name = 'w국수'),
   '00000000-0000-0000-0000-000000000002', true, now() - interval '1 minute');
-- 쿠폰 기록: 한식당 제휴는 두 판(한 판은 두 사람), 양식당 제휴는 없다
insert into public.coupon_claims (restaurant_id, session_id, user_id, code) values
  ((select id from public.restaurants where source_id = 'w/3'), '20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'AAAAAA'),
  ((select id from public.restaurants where source_id = 'w/3'), '20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'AAAAAA'),
  ((select id from public.restaurants where source_id = 'w/3'), '20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'BBBBBB');

-- (5) 사진 칸: 제휴 식당만, 우리 버킷 주소만
select lives_ok($$ update public.restaurants
  set photo_url = 'https://example.supabase.co/storage/v1/object/public/restaurant-photos/w3.jpg' where source_id = 'w/3' $$,
  '제휴 식당에 우리 버킷 주소의 사진을 넣을 수 있다');
select throws_ok($$ update public.restaurants
  set photo_url = 'https://example.supabase.co/storage/v1/object/public/restaurant-photos/w5.jpg' where source_id = 'w/5' $$,
  '23514', null, '제휴가 아닌 식당에는 사진을 넣을 수 없다');
select throws_ok($$ update public.restaurants
  set photo_url = 'https://search.pstatic.net/common/w4.jpg' where source_id = 'w/4' $$,
  '23514', null, '버킷 경로가 아닌 사진 주소는 넣을 수 없다');
select throws_ok($$ update public.restaurants set partner = false where source_id = 'w/3' $$,
  '23514', null, '사진이 있는 채로 제휴를 풀 수 없다');

create temp table t_v as select * from public.session_restaurants('20000000-0000-0000-0000-000000000001') limit 0;
alter table t_v add column pos int generated always as identity;
create temp table t_d as select * from public.session_restaurants('20000000-0000-0000-0000-000000000001') limit 0;
grant all on t_v, t_d to authenticated;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
insert into t_v (id, name, cuisine, partner, coupon_text, match, my_code, food_id, walk_minutes, open_now, team_count, photo_url)
  select * from public.session_restaurants('20000000-0000-0000-0000-000000000001');
insert into t_d select * from public.session_restaurants('20000000-0000-0000-0000-000000000003');
select is((select count(*)::int from public.session_restaurants('20000000-0000-0000-0000-000000000002')), 0,
  '후보가 없는 판은 0행');
select throws_ok($$ select public.claim_coupon('20000000-0000-0000-0000-000000000001',
  (select id from public.restaurants where source_id = 'w/3')) $$,
  'P0001', 'not_done', '쿠폰은 여전히 끝난 판에서만 받는다');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('restaurant-photos', 'x.jpg') $$,
  '42501', null, '앱 사용자는 사진 버킷에 올릴 수 없다');
reset role;

-- (1) 투표 단계: 후보 전체 기준, 최대 6곳
select is((select count(*)::int from t_v), 6, '끝나지 않은 판은 후보 기준으로 최대 6곳');
select is((select array_agg(name order by name) from (select name from t_v where pos <= 2) x),
  array['대표메뉴집', '할매 w국수'], '어느 후보든 이름이나 대표 메뉴가 맞는 곳이 먼저');
select is((select array_agg(name order by name) from (select name from t_v where pos in (3, 4)) x),
  array['양식당 제휴', '한식당 제휴'], '그다음은 후보와 같은 종류, 같은 조건이면 제휴가 위로');
select ok(not exists (select 1 from t_v where name = '일식당'), '후보와 종류가 다른 식당은 안 나온다');
select is((select food_id from t_v where name = '할매 w국수'), (select id from public.foods where name = 'w국수'),
  '메뉴가 맞으면 food_id는 맞은 후보 (못 먹는 사람이 있는 후보도 기준에 든다)');
select is((select food_id from t_v where name = '대표메뉴집'), (select id from public.foods where name = 'w파스타'),
  '대표 메뉴로 맞아도 food_id가 온다');
select is((select count(*)::int from t_v where match = 'cuisine' and food_id is not null), 0, '종류만 맞으면 food_id는 null');
select is((select count(*)::int from t_v where my_code is not null), 0, '투표 단계에는 받은 쿠폰이 없다');

-- 끝난 판은 0015와 같이 결정된 음식 기준 최대 3곳
select is((select count(*)::int from t_d), 3, '끝난 판은 최대 3곳');
select is((select name from t_d where match = 'menu'), '할매 w국수', '끝난 판은 결정된 음식만 기준이다 (w파스타 대표메뉴집은 안 나온다)');
select ok(exists (select 1 from t_d where name = '한식당 제휴'), '끝난 판도 같은 종류에서는 제휴가 먼저');

-- (4) 밥BTI로 간 모임 N팀, (5) 사진, (3) 영업 중이 줄에 같이 온다
select is((select team_count from t_v where name = '한식당 제휴'), 2, '간 모임 수는 쿠폰을 받은 서로 다른 판 수 (한 판에 둘이 받아도 한 팀)');
select is((select team_count from t_v where name = '양식당 제휴'), 0, '쿠폰 기록이 없으면 0');
select is((select photo_url from t_v where name = '한식당 제휴'),
  'https://example.supabase.co/storage/v1/object/public/restaurant-photos/w3.jpg', '제휴 식당 사진 주소가 온다');
select is((select open_now from t_v where name = '한식당 제휴'), true, '영업시간이 24/7이면 영업 중');
select is((select open_now from t_v where name = '양식당 제휴'), null, '읽지 못하는 영업시간이면 null');
select is((select open_now from t_v where name = '할매 w국수'), null, '영업시간이 없으면 null');
select is((select walk_minutes from t_v where name = '할매 w국수'), null, '좌표가 없거나 정문을 모르는 동네면 걸어서 몇 분은 null');

-- (2) 걸어서 몇 분: 직선거리 × 1.3 ÷ 분당 80m, 올림, 최소 1분
select is(public.walk_minutes('erica', 37.2998, 126.8369), 1, '정문 바로 앞은 1분');
select is(public.walk_minutes('erica', 37.3010652, 126.8393899), 5, '정문에서 직선 약 261m(피자스쿨 좌표)는 5분');
select is(public.walk_minutes('erica', null, 126.84), null, '좌표가 비면 null');

-- (3) 영업 중: 한국 시간. 2026-11-16은 월요일
select is(public.is_open_now('Mo-Su 10:00-22:00', '2026-11-16 12:00+09'), true, '매일 10~22시, 월 12시는 영업 중');
select is(public.is_open_now('Mo-Su 10:00-22:00', '2026-11-16 14:00+00'), false, 'UTC 14시는 한국 23시라 닫았다');
select is(public.is_open_now('Mo-Su 11:00-01:00', '2026-11-17 00:30+09'), true, '자정을 넘기는 시간대는 다음 날 새벽에도 영업 중');
select is(public.is_open_now('Mo-Su 11:00-01:00', '2026-11-17 02:00+09'), false, '새벽 1시가 지나면 닫았다');
select is(
  array[
    public.is_open_now('Mo-Fr 11:30-15:00, 17:00-21:00; Sa 11:30-16:00; Su off', '2026-11-16 16:00+09'),
    public.is_open_now('Mo-Fr 11:30-15:00, 17:00-21:00; Sa 11:30-16:00; Su off', '2026-11-16 17:30+09'),
    public.is_open_now('Mo-Fr 11:30-15:00, 17:00-21:00; Sa 11:30-16:00; Su off', '2026-11-21 15:30+09'),
    public.is_open_now('Mo-Fr 11:30-15:00, 17:00-21:00; Sa 11:30-16:00; Su off', '2026-11-21 17:30+09'),
    public.is_open_now('Mo-Fr 11:30-15:00, 17:00-21:00; Sa 11:30-16:00; Su off', '2026-11-22 12:00+09')
  ],
  array[false, true, true, false, false], '쉬는 시간, 요일마다 다른 시간, 쉬는 날(off)');
select is(
  array[
    public.is_open_now('Mo-Fr 10:30-20:00; Sa,Su,PH off', '2026-11-16 12:00+09'),
    public.is_open_now('Mo-Fr 10:30-20:00; Sa,Su,PH off', '2026-11-21 12:00+09'),
    public.is_open_now('Mo-Su 10:00-24:00', '2026-11-16 23:59+09')
  ],
  array[true, false, true], '요일 나열과 공휴일 표기, 24:00');
select is(public.is_open_now(null, '2026-11-16 12:00+09'), null, '영업시간이 없으면 null');
select is(public.is_open_now('전화로 확인', '2026-11-16 12:00+09'), null, '읽지 못하는 모양이면 null');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select * from public.session_restaurants('20000000-0000-0000-0000-000000000001') $$,
  'P0001', 'not_member', '다른 모임 판은 투표 단계에서도 못 본다');
reset role;

select * from finish();
rollback;
