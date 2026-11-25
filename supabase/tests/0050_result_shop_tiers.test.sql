-- 결과 뒤 가게 묶음: 메뉴가 맞는 가게, 같은 종류 일반 가게, 다른 음식 전문점 (명세 4-21, 0050)
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id) values ('00000000-0000-0000-0000-000000005001');
insert into public.profiles (user_id, display_name, college) values ('00000000-0000-0000-0000-000000005001', '소융', 'computing');
-- 시험용 동네(zz_t50). 짜장면 판. 0051부터 대홍훠궈샤브샤브의 업태 짐작은 menus_guess에 있다(아래 update)
insert into public.restaurants (area, name, cuisine, menus, lat, lng, partner, coupon_text, source_id) values
  ('zz_t50', '대홍훠궈샤브샤브', 'chinese', '{}', 37.3000, 126.8369, false, null, 'z50/1'),
  ('zz_t50', '보배반점', 'chinese', '{짜장면,짬뽕,탕수육}', 37.3030, 126.8369, false, null, 'z50/2'),
  ('zz_t50', '도야짬뽕', 'chinese', '{짬뽕}', 37.3001, 126.8369, false, null, 'z50/3'),
  ('zz_t50', '북경', 'chinese', '{}', 37.3005, 126.8369, false, null, 'z50/4'),
  ('zz_t50', '교동짬뽕', 'chinese', '{짬뽕,짜장면,탕수육}', 37.3040, 126.8369, false, null, 'z50/5'),
  ('zz_t50', '쿠폰 중국집', 'chinese', '{}', 37.3080, 126.8369, true, '밥BTI 보여 주면 만두', 'z50/6'),
  ('zz_t50', '홍성마라미방', 'chinese', '{마라탕}', 37.2999, 126.8369, false, null, 'z50/7');
update public.restaurants set menus_guess = '{짜장면,짬뽕,탕수육}' where source_id = 'z50/1';
insert into public.council_benefits (college, council_name, shop_name, restaurant_id, benefit, source_url, checked_on, status, source_key, show_in_app)
select 'computing', '시험', v.shop, r.id, v.benefit, 'https://example.com', current_date, 'notice', v.k, true
from (values
  ('대홍훠궈샤브샤브', E'2인 이상 무한 리필 주문 시\n1. 음료 1개', 'zz_t50_1'),
  ('도야짬뽕', '인원수만큼 만두', 'zz_t50_2'),
  ('교동짬뽕', '음료 1개', 'zz_t50_3')
) as v (shop, benefit, k)
join public.restaurants r on r.area = 'zz_t50' and r.name = v.shop;
insert into public.groups (id, name, invite_code, created_by, area) values
  ('10000000-0000-0000-0000-000000005001', '묶음 모임', 'TESTFQ', '00000000-0000-0000-0000-000000005001', 'zz_t50');
insert into public.memberships (group_id, user_id, display_name) values
  ('10000000-0000-0000-0000-000000005001', '00000000-0000-0000-0000-000000005001', '소융');
insert into public.sessions (id, group_id, host_user_id, status, decided_food_id) values
  ('20000000-0000-0000-0000-000000005001', '10000000-0000-0000-0000-000000005001', '00000000-0000-0000-0000-000000005001', 'done',
   (select id from public.foods where name = '짜장면' and not custom order by id limit 1)),
  ('20000000-0000-0000-0000-000000005002', '10000000-0000-0000-0000-000000005001', '00000000-0000-0000-0000-000000005001', 'voting', null);
insert into public.candidates (session_id, food_id, proposed_by, vetoed) values
  ('20000000-0000-0000-0000-000000005002', (select id from public.foods where name = '짜장면' and not custom order by id limit 1),
   '00000000-0000-0000-0000-000000005001', false);

create temp table t_d as select * from public.session_restaurants('20000000-0000-0000-0000-000000005001') limit 0;
alter table t_d add column pos int generated always as identity;
create temp table t_v as select * from public.session_restaurants('20000000-0000-0000-0000-000000005001') limit 0;
alter table t_v add column pos int generated always as identity;
grant all on t_d, t_v to authenticated;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000005001","role":"authenticated"}', true);
insert into t_d (id, name, cuisine, partner, coupon_text, match, my_code, food_id, walk_minutes, open_now, team_count, photo_url,
  council_college, council_text, total_count, menu_name, menu_cuisine, tier)
  select * from public.session_restaurants('20000000-0000-0000-0000-000000005001');
insert into t_v (id, name, cuisine, partner, coupon_text, match, my_code, food_id, walk_minutes, open_now, team_count, photo_url,
  council_college, council_text, total_count, menu_name, menu_cuisine, tier)
  select * from public.session_restaurants('20000000-0000-0000-0000-000000005002');
reset role;

select results_eq($$ select name from t_d order by pos $$,
  $$ values ('교동짬뽕'::text), ('보배반점'::text), ('쿠폰 중국집'::text) $$,
  '짜장면 판 위 3곳: 짜장면 파는 가게(그 안에서 학생회 제휴가 먼저), 그다음 일반 중국집의 쿠폰 가게');
select results_eq($$ select name from t_v order by pos $$,
  $$ values ('교동짬뽕'::text), ('보배반점'::text), ('쿠폰 중국집'::text), ('북경'::text), ('대홍훠궈샤브샤브'::text), ('도야짬뽕'::text) $$,
  '투표 단계도 같은 순서: 전문점(훠궈, 짬뽕, 마라)은 일반 중국집 뒤로, 학생회 제휴여도');
select results_eq($$ select tier from t_v order by pos $$, $$ values (1), (1), (2), (2), (3), (3) $$, '묶음 번호가 같이 온다');
select is((select max(total_count) from t_d), 7, '맞는 가게는 7곳(홍성마라미방은 7번째)');
select is((select match from t_v where name = '대홍훠궈샤브샤브'), 'cuisine',
  '업태로 채운 대표 메뉴에 짜장면이 있어도 이름이 다른 음식 전문점이면 메뉴가 맞는 곳이 아니다');
select is((select food_id from t_v where name = '대홍훠궈샤브샤브'), null::bigint, '그래서 맞은 음식도 없다');
select is((select match from t_v where name = '교동짬뽕'), 'menu', '이름의 음식(짬뽕)이 대표 메뉴에 같이 있으면 대표 메뉴를 믿는다');
select is((select council_text from t_v where name = '대홍훠궈샤브샤브'), E'2인 이상 무한 리필 주문 시\n1. 음료 1개',
  '학생회 혜택은 원문 그대로 온다');

-- 판정 함수
select ok(public.shop_is_specialty('홍성마라미방', null, '{짜장면}'), '마라는 foods 표 밖 전문점 낱말');
select ok(not public.shop_is_specialty('홍성마라미방', null, '{마라탕}'), '기준 음식과 겹치는 낱말은 다른 음식이 아니다');
select ok(not public.shop_is_specialty('김밥천국', '{떡볶이,김밥,라면}', '{떡볶이}'), '이름의 음식이 대표 메뉴에도 있으면 대표 메뉴를 믿는다');
select ok(public.shop_is_specialty('김밥천국', null, '{떡볶이}'), '이름만 보면 김밥 전문점');
select ok(not has_function_privilege('authenticated', 'public.shop_is_specialty(text, text[], text[])', 'execute'),
  '판정 함수는 앱에서 부르지 못한다');
select is((select count(*)::int from pg_proc p where p.pronamespace = 'public'::regnamespace
  and p.proname in ('shop_specialty_words', 'shop_is_specialty', 'my_council_pick', 'session_restaurants')
  and 'search_path=""' = any (p.proconfig)), 4, '네 함수 모두 search_path를 비워 고정한다');

select * from finish();
rollback;
