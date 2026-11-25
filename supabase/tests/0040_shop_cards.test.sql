-- 가게 칸 바로잡기: 그림 낱말 표, 카페 그림, 혜택 있는 제휴만 "광고", 채운 메뉴와 주소 (명세 4-26, 0040)
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

-- CI의 빈 DB에는 음식 그림 파일 이름이 없다(0026은 실제 서버용). 이 테스트에서 쓰는 음식에만 넣는다
update public.foods set image_path = id || '.webp'
where not custom and image_path is null and name in ('감자탕', '돼지국밥', '김치찌개', '샌드위치');
insert into auth.users (id) values ('00000000-0000-0000-0000-000000004001');
insert into public.restaurants (area, name, cuisine, menus, lat, lng, partner, coupon_text, source_id) values
  ('zz_t40', '원조 뼈해장국', 'korean', '{}', 37.3000, 126.8370, false, null, 't40/1'),
  ('zz_t40', '상록 한정식', 'korean', '{}', 37.3001, 126.8370, false, null, 't40/2'),
  ('zz_t40', '빵굽는 마을', 'cafe', '{}', 37.3002, 126.8370, false, null, 't40/3'),
  ('zz_t40', '설빙 사동점', 'cafe', '{}', 37.3003, 126.8370, false, null, 't40/4'),
  ('zz_t40', '문구 없는 제휴 카페', 'cafe', '{}', 37.3004, 126.8370, true, null, 't40/5'),
  ('zz_t40', '빈칸 문구 제휴 집', 'korean', '{김치찌개}', 37.3005, 126.8370, true, '  ', 't40/6'),
  ('zz_t40', '혜택 있는 제휴 집', 'korean', '{}', 37.3090, 126.8450, true, '음료 한 캔', 't40/7'),
  ('zz_t40', '순대 집', 'korean', '{순대국}', 37.3006, 126.8370, false, null, 't40/8');
insert into public.groups (id, name, invite_code, created_by, area) values
  ('10000000-0000-0000-0000-000000004001', '그림 모임', 'TESTSF', '00000000-0000-0000-0000-000000004001', 'zz_t40');
insert into public.memberships (group_id, user_id, display_name) values
  ('10000000-0000-0000-0000-000000004001', '00000000-0000-0000-0000-000000004001', '하나');
insert into public.sessions (id, group_id, host_user_id, status, decided_food_id) values
  ('20000000-0000-0000-0000-000000004001', '10000000-0000-0000-0000-000000004001', '00000000-0000-0000-0000-000000004001', 'done',
   (select id from public.foods where name = '김치찌개' and not custom));

select is(public.shop_food_word('통돼지볶음찌개'), '김치찌개', '긴 낱말이 먼저 맞는다(돼지보다 볶음찌개)');
select is(public.shop_food_word('BBQ 치킨'), '치킨', '영문 낱말은 대소문자를 보지 않는다');
select is(public.shop_food_word('상록한정식'), null::text, '낱말이 없으면 null');
select is(public.shop_cafe_image('한양베이커리 에리카점'), 'cafe/bread.webp', '빵집 낱말이면 빵 그림');
select is(public.shop_cafe_image('키미케이크'), 'cafe/dessert.webp', '디저트 낱말이면 디저트 그림');
select is(public.shop_cafe_image('오쏘커피'), 'cafe/coffee.webp', '나머지 카페는 커피 그림');

create temp table t_s as select * from public.shop_list() limit 0;
create temp table t_c as select * from public.session_cafes('20000000-0000-0000-0000-000000004001') limit 0;
create temp table t_r as select * from public.session_restaurants('20000000-0000-0000-0000-000000004001') limit 0;
create temp table t_d (d jsonb);
grant all on t_s, t_c, t_r, t_d to authenticated;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000004001","role":"authenticated"}', true);
set local role authenticated;
insert into t_s select * from public.shop_list();
insert into t_c select * from public.session_cafes('20000000-0000-0000-0000-000000004001');
insert into t_r select * from public.session_restaurants('20000000-0000-0000-0000-000000004001');
insert into t_d select public.shop_detail((select id from public.restaurants where source_id = 't40/5'));
reset role;

select is((select f.name from t_s join public.foods f on f.id = t_s.thumb_food_id where t_s.name = '원조 뼈해장국'), '감자탕',
  '가게 이름 낱말(뼈해장)로 음식 그림을 찾는다');
select is((select f.name from t_s join public.foods f on f.id = t_s.thumb_food_id where t_s.name = '순대 집'), '돼지국밥',
  '대표 메뉴 낱말(순대)로 음식 그림을 찾는다');
select is((select thumb_food_id from t_s where name = '상록 한정식'), null::bigint,
  '못 찾으면 종류의 대표 음식(비빔밥)으로 가지 않고 null');
select is((select thumb_image from t_s where name = '빵굽는 마을'), 'cafe/bread.webp', '카페는 이름으로 고른 카페 그림');
select is((select name from t_s limit 1), '혜택 있는 제휴 집', '혜택 문구가 있는 제휴만 먼저(가장 멀어도)');
select is((select count(*)::int from t_s where partner), 1, '문구가 없거나 빈칸인 제휴는 "광고"가 붙지 않는다');
select is((select d -> 'partner' from t_d), 'false'::jsonb, '가게 상세도 문구 없는 제휴는 광고가 아니다');
select is((select count(*)::int from t_c where partner), 0, '먹고 나서 카페도 문구 없는 제휴는 광고가 아니다');
select is((select partner from t_r where name = '빈칸 문구 제휴 집'), false, '이 메뉴 파는 학교 앞도 같다');

select is((select menus from public.restaurants where source_id = 'node/8431229418'), array['칼국수'],
  '이름에 음식 이름이 그대로 있으면 빈 대표 메뉴를 채운다');
select is((select cuisine from public.restaurants where source_id = 'node/8431229418'), 'korean', '종류가 비어 있던 칼국수집은 한식');

select * from finish();
rollback;
