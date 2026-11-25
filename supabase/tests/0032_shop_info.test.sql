-- 가게 정보와 사진, 가게 목록과 상세 (명세 4-26, 0032)
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000003201'),  -- s_test 모임 사람
  ('00000000-0000-0000-0000-000000003202');  -- 모임이 없는 사람
insert into public.foods (name, tags, cuisine, image_path) values ('s비빔국수', array[]::text[], 'korean', '999001.webp');
-- 예시 동네(zz_test, 정문 좌표는 ERICA와 같다)라 seed의 ERICA 식당과 섞이지 않는다
insert into public.restaurants (area, name, cuisine, menus, lat, lng, partner, coupon_text, address, licensed_on, phone, source_id) values
  ('zz_test', '하 가까운 집', 'korean', '{}', 37.3000, 126.8370, false, '안 보여야 하는 문구', '경기도 안산시 상록구 시험로 1', '2015-03-02', '031-000-0001', 's/1'),
  ('zz_test', '먼 제휴 집', 'chinese', '{}', 37.3050, 126.8450, true, '음료 한 캔', null, null, null, 's/2'),
  ('zz_test', '대표메뉴 집', null, '{s비빔국수}', 37.3010, 126.8380, false, null, null, null, null, 's/3'),
  ('zz_test', '좌표 없는 카페', 'cafe', '{}', null, null, false, null, null, null, null, 's/4'),
  ('zz_test', '가 먼 집', 'korean', '{}', 37.3040, 126.8440, false, null, null, null, null, 's/6'),
  ('s_other', '다른 동네 집', 'korean', '{}', 37.3000, 126.8370, true, '쿠폰', null, null, null, 's/5');
insert into public.shop_photos (restaurant_id, path, sort, credit) values
  ((select id from public.restaurants where source_id = 's/1'), 's1/2.jpg', 1, '밥BTI 팀 촬영'),
  ((select id from public.restaurants where source_id = 's/1'), 's1/1.jpg', 0, '사장님 제공');
insert into public.groups (id, name, invite_code, created_by, area) values
  ('10000000-0000-0000-0000-000000003201', '가게 모임', 'TESTS1', '00000000-0000-0000-0000-000000003201', 'zz_test');
insert into public.memberships (group_id, user_id, display_name) values
  ('10000000-0000-0000-0000-000000003201', '00000000-0000-0000-0000-000000003201', '하나');

select ok((select count(*) from public.restaurants where area = 'erica' and address is not null) >= 150,
  '공공데이터로 맞춘 가게에 주소가 들어갔다');
select ok((select count(*) from public.restaurants where area = 'erica' and licensed_on is not null) >= 150,
  '영업 신고일이 들어갔다');
select is((select count(*)::int from public.restaurants where phone ~ '^01'), 0, '휴대전화 번호는 넣지 않는다');
select throws_ok($$ insert into public.shop_photos (restaurant_id, path) values
  ((select id from public.restaurants where source_id = 's/1'), 'https://example.com/a.jpg') $$,
  '23514', null, '사진 경로는 버킷 안 파일 이름만 받는다');

create temp table t_s as select * from public.shop_list() limit 0;
grant all on t_s to authenticated;
create temp table t_d (d jsonb);
grant all on t_d to authenticated;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000003201","role":"authenticated"}', true);
set local role authenticated;
insert into t_s select * from public.shop_list();
insert into t_d select public.shop_detail((select id from public.restaurants where source_id = 's/1'));
select throws_ok($$ insert into public.shop_photos (restaurant_id, path) values (1, 'x/1.jpg') $$,
  '42501', null, '앱 사용자는 사진을 올리지 못한다');
select throws_ok($$ select public.shop_detail(-1) $$, 'P0001', 'not_found', '없는 가게는 not_found');
reset role;

select is((select array_agg(name order by ord) from (select name, row_number() over () as ord from t_s) x),
  array['먼 제휴 집', '하 가까운 집', '대표메뉴 집', '가 먼 집', '좌표 없는 카페'],
  '내 모임 동네의 가게만, 제휴 먼저, 그다음 정문에서 가까운 순(이름 순이 아니다), 좌표가 없으면 맨 뒤');
select is((select walk_minutes from t_s where name = '하 가까운 집'), 1, '정문 바로 앞은 걸어서 1분');
select is((select coupon_text from t_s where name = '하 가까운 집'), null::text, '제휴가 아니면 쿠폰 문구가 나가지 않는다');
select is((select photo_path from t_s where name = '하 가까운 집'), 's1/1.jpg', '대표 사진은 sort가 가장 작은 것');
select is((select thumb_image from t_s where name = '대표메뉴 집'), '999001.webp', '사진이 없으면 대표 메뉴의 음식 그림');
select is((select thumb_food_id from t_s where name = '좌표 없는 카페'), null::bigint, '카페는 음식 그림이 없다(화면이 아이콘을 그린다)');
select is((select d ->> 'licensed_year' from t_d), '2015', '상세에 영업 신고 연도');
select is((select jsonb_array_length(d -> 'photos') from t_d), 2, '상세에 사진 두 장');
select is((select d -> 'visits' from t_d), 'null'::jsonb, '다녀간 팀이 5팀이 안 되면 숫자를 주지 않는다');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000003202","role":"authenticated"}', true);
set local role authenticated;
select ok((select count(*) from public.shop_list()) > 100 and not exists (select 1 from public.shop_list() where name = '하 가까운 집'),
  '모임이 없으면 ERICA 가게가 나온다');
reset role;

select * from finish();
rollback;
