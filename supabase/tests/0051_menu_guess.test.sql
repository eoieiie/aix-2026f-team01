-- 업태 짐작 메뉴는 menus_guess로 (명세 4-21, 4-26, 0051)
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

-- 마이그레이션이 옮긴 실제 가게(0017 자료)
select is((select menus from public.restaurants where source_id = 'localdata/5550000-101-2004-00136'), '{}'::text[],
  '대홍훠궈샤브샤브는 이름에 근거가 없어 대표 메뉴가 비었다');
select is((select menus_guess from public.restaurants where source_id = 'localdata/5550000-101-2004-00136'), array['짜장면', '짬뽕', '탕수육'],
  '업태로 짐작한 메뉴는 menus_guess로 옮겼다');
select ok(not exists (select 1 from public.restaurants r, unnest(r.menus) as m
  where r.area <> 'zz_test' and not public.shop_menu_evidence(r.name, m)), '남은 대표 메뉴는 모두 가게 이름에 근거가 있다');

-- 나누기 규칙
select is((select row(menus, guess, dropped)::text from public.shop_split_menus('봉구스밥버거', 'korean', '{햄버거,떡볶이,김밥,라면}')),
  row(array['햄버거'], array['떡볶이', '김밥', '라면'], '{}'::text[])::text, '별칭(버거)은 근거, 분식 짐작은 짐작으로');
select is((select row(menus, guess, dropped)::text from public.shop_split_menus('파앤피파스타하우스', 'western', '{토마토 파스타,짜장면,짬뽕,탕수육}')),
  row(array['토마토 파스타'], '{}'::text[], array['짜장면', '짬뽕', '탕수육'])::text, '가게 종류(양식)와 다른 짐작(중식)은 버린다');
select ok(public.shop_menu_evidence('오늘도부찌안산한대점', '부대찌개'), '0040의 이름 별칭(부찌)도 근거');
select ok(public.shop_menu_evidence('언니네화덕핏짜', '피자'), '핏짜도 근거');
select ok(public.shop_menu_evidence('토마토 파스타집', '토마토 파스타'), '띄어쓰기는 보지 않는다');
select ok(not public.shop_menu_evidence('보배반점', '짜장면'), '반점은 이름 근거가 아니다(짐작)');

-- 화면과 순서
insert into auth.users (id) values ('00000000-0000-0000-0000-000000005101');
insert into public.profiles (user_id, display_name) values ('00000000-0000-0000-0000-000000005101', '하나');
insert into public.restaurants (area, name, cuisine, menus, menus_guess, lat, lng, partner, coupon_text, source_id) values
  ('zz_t51', '짜장면 명가', 'chinese', '{짜장면}', '{}', 37.3050, 126.8369, false, null, 'z51/1'),
  ('zz_t51', '보배반점', 'chinese', '{}', '{짜장면,짬뽕,탕수육}', 37.3000, 126.8369, false, null, 'z51/2'),
  ('zz_t51', '대홍훠궈샤브샤브', 'chinese', '{}', '{짜장면,짬뽕,탕수육}', 37.2999, 126.8369, false, null, 'z51/3');
insert into public.groups (id, name, invite_code, created_by, area) values
  ('10000000-0000-0000-0000-000000005101', '짐작 모임', 'TESTGQ', '00000000-0000-0000-0000-000000005101', 'zz_t51');
insert into public.memberships (group_id, user_id, display_name) values
  ('10000000-0000-0000-0000-000000005101', '00000000-0000-0000-0000-000000005101', '하나');
insert into public.sessions (id, group_id, host_user_id, status, decided_food_id) values
  ('20000000-0000-0000-0000-000000005101', '10000000-0000-0000-0000-000000005101', '00000000-0000-0000-0000-000000005101', 'done',
   (select id from public.foods where name = '짜장면' and not custom order by id limit 1));

create temp table t_d as select * from public.session_restaurants('20000000-0000-0000-0000-000000005101') limit 0;
alter table t_d add column pos int generated always as identity;
create temp table t_l as select * from public.shop_list() limit 0;
create temp table t_x (d jsonb);
grant all on t_d, t_l, t_x to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000005101","role":"authenticated"}', true);
insert into t_d (id, name, cuisine, partner, coupon_text, match, my_code, food_id, walk_minutes, open_now, team_count, photo_url,
  council_college, council_text, total_count, menu_name, menu_cuisine, tier)
  select * from public.session_restaurants('20000000-0000-0000-0000-000000005101');
insert into t_l select * from public.shop_list();
insert into t_x select public.shop_detail((select id from public.restaurants where source_id = 'z51/2'));
reset role;

select results_eq($$ select name from t_d order by pos $$,
  $$ values ('짜장면 명가'::text), ('보배반점'::text), ('대홍훠궈샤브샤브'::text) $$,
  '대표 메뉴가 맞는 곳, 짐작만 맞는 일반 가게, 전문점 순');
select is((select tier from t_d where name = '보배반점'), 2, '짐작만 맞으면 (2) 일반 가게');
select is((select match from t_d where name = '보배반점'), 'cuisine', '짐작은 메뉴 일치로 치지 않는다');
select is((select tier from t_d where name = '대홍훠궈샤브샤브'), 3, '전문점은 짐작이 있어도 (3)');
select is((select d -> 'menus' from t_x), '[]'::jsonb, '가게 상세의 대표 메뉴에는 짐작이 나오지 않는다');
select is((select thumb_food_id from t_l where name = '대홍훠궈샤브샤브'), null::bigint, '가게 그림도 짐작 메뉴로 고르지 않는다');
select is((select menus_guess from t_l where name = '보배반점'), array['짜장면', '짬뽕', '탕수육'], '가게 목록은 찾기용 짐작을 같이 준다');
-- 그림 경로가 없는 로컬 DB에서도 그림 함수가 음식을 고를 수 있게(되돌림)
update public.foods set image_path = coalesce(image_path, 'zz_t51.webp') where name in ('짜장면', '치킨') and not custom;
select is(public.shop_thumb_food('보배반점 안산한양대에리카점', '{}', 'chinese'), null::bigint, '반점 같은 업종 낱말로 그림을 고르지 않는다');
select is((select name from public.foods where id = public.shop_thumb_food('대학통닭', '{}', 'western')), '치킨', '음식을 말하는 이름 낱말(통닭)은 그대로');
select ok(not has_function_privilege('authenticated', 'public.shop_split_menus(text, text, text[])', 'execute'), '나누기 함수는 앱에서 부르지 못한다');

select * from finish();
rollback;
