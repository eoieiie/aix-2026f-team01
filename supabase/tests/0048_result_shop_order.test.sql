-- 결과 뒤 가게와 카페 순서: 쿠폰 가게, 내 학생회 제휴, 가까운 순 (명세 4-21, 4-23, 4-29, 0048)
begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000004801'),  -- 소융대
  ('00000000-0000-0000-0000-000000004802'),  -- 공대
  ('00000000-0000-0000-0000-000000004803');  -- 단과대를 말하지 않음
insert into public.profiles (user_id, display_name, college) values
  ('00000000-0000-0000-0000-000000004801', '소융', 'computing'),
  ('00000000-0000-0000-0000-000000004802', '공대', 'eng'),
  ('00000000-0000-0000-0000-000000004803', '없음', null);
insert into public.foods (name, tags, cuisine) values ('z48짜장', array[]::text[], 'chinese');
-- 시험용 동네(zz_t48). 정문을 모르는 동네라 ERICA 정문에서 잰다. 위도가 클수록 멀다
insert into public.restaurants (area, name, cuisine, menus, lat, lng, partner, coupon_text, source_id) values
  ('zz_t48', '쿠폰집', 'chinese', '{}', 37.3090, 126.8369, true, '밥BTI 보여 주면 만두', 'z48/1'),
  ('zz_t48', '소융 제휴집', 'chinese', '{}', 37.3050, 126.8369, false, null, 'z48/2'),
  ('zz_t48', '총학 제휴집', 'chinese', '{}', 37.3060, 126.8369, false, null, 'z48/3'),
  ('zz_t48', '공대 제휴집', 'chinese', '{}', 37.3000, 126.8369, false, null, 'z48/4'),
  ('zz_t48', '가까운 중국집', 'chinese', '{}', 37.2999, 126.8369, false, null, 'z48/5'),
  ('zz_t48', 'z48짜장 전문', 'chinese', '{}', 37.3030, 126.8369, false, null, 'z48/6'),
  ('zz_t48', '카페 쿠폰', 'cafe', '{}', 37.3090, 126.8369, true, '아메리카노 500원 할인', 'z48/c1'),
  ('zz_t48', '카페 소융 제휴', 'cafe', '{}', 37.3080, 126.8369, true, null, 'z48/c2'),
  ('zz_t48', '카페 가까움', 'cafe', '{}', 37.2999, 126.8369, false, null, 'z48/c3'),
  ('zz_t48', '카페 중간', 'cafe', '{}', 37.3020, 126.8369, false, null, 'z48/c4');
insert into public.council_benefits (college, council_name, shop_name, restaurant_id, benefit, source_url, checked_on, status, source_key, show_in_app)
select v.college, '시험', v.shop, r.id, v.benefit, 'https://example.com', current_date, 'notice', v.k, v.show
from (values
  ('computing', '소융 제휴집', E'(여름 한정)\n1. 인원수만큼 만두\n2. 음료 1개', 'zz_t48_1', true),
  ('all', '총학 제휴집', '10% 할인', 'zz_t48_2', true),
  ('eng', '공대 제휴집', '음료 1개', 'zz_t48_3', true),
  ('computing', '가까운 중국집', '숨긴 혜택', 'zz_t48_4', false),
  ('computing', '카페 소융 제휴', '음료 500원 할인', 'zz_t48_5', true)
) as v (college, shop, benefit, k, show)
join public.restaurants r on r.area = 'zz_t48' and r.name = v.shop;
insert into public.groups (id, name, invite_code, created_by, area) values
  ('10000000-0000-0000-0000-000000004801', '순서 모임', 'TEST48', '00000000-0000-0000-0000-000000004801', 'zz_t48');
insert into public.memberships (group_id, user_id, display_name) values
  ('10000000-0000-0000-0000-000000004801', '00000000-0000-0000-0000-000000004801', '소융'),
  ('10000000-0000-0000-0000-000000004801', '00000000-0000-0000-0000-000000004802', '공대'),
  ('10000000-0000-0000-0000-000000004801', '00000000-0000-0000-0000-000000004803', '없음');
insert into public.sessions (id, group_id, host_user_id, status, decided_food_id) values
  ('20000000-0000-0000-0000-000000004801', '10000000-0000-0000-0000-000000004801', '00000000-0000-0000-0000-000000004801', 'done',
   (select id from public.foods where name = 'z48짜장'));

create temp table t_a as select * from public.session_restaurants('20000000-0000-0000-0000-000000004801') limit 0;
alter table t_a add column who text, add column pos int generated always as identity;
create temp table t_c as select * from public.session_cafes('20000000-0000-0000-0000-000000004801') limit 0;
alter table t_c add column pos int generated always as identity;
grant all on t_a, t_c to authenticated;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000004801","role":"authenticated"}', true);
insert into t_a (id, name, cuisine, partner, coupon_text, match, my_code, food_id, walk_minutes, open_now, team_count, photo_url,
  council_college, council_text, total_count, menu_name, menu_cuisine, who)
  select *, 'computing' from public.session_restaurants('20000000-0000-0000-0000-000000004801');
insert into t_c (id, name, partner, coupon_text, my_code, lat, lng, council_college, council_text, total_count)
  select * from public.session_cafes('20000000-0000-0000-0000-000000004801');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000004802","role":"authenticated"}', true);
insert into t_a (id, name, cuisine, partner, coupon_text, match, my_code, food_id, walk_minutes, open_now, team_count, photo_url,
  council_college, council_text, total_count, menu_name, menu_cuisine, who)
  select *, 'eng' from public.session_restaurants('20000000-0000-0000-0000-000000004801');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000004803","role":"authenticated"}', true);
insert into t_a (id, name, cuisine, partner, coupon_text, match, my_code, food_id, walk_minutes, open_now, team_count, photo_url,
  council_college, council_text, total_count, menu_name, menu_cuisine, who)
  select *, 'none' from public.session_restaurants('20000000-0000-0000-0000-000000004801');
select ok(not has_function_privilege('authenticated', 'public.my_council_pick(bigint, text)', 'execute'),
  '남의 단과대로 학생회 제휴를 고르는 함수는 앱에서 부르지 못한다');
reset role;

-- 소융대 사람: 쿠폰 가게, 소융대와 총학생회 제휴(가까운 순), 나머지는 가까운 순
select results_eq($$ select name from t_a where who = 'computing' order by pos $$,
  $$ values ('쿠폰집'::text), ('소융 제휴집'::text), ('총학 제휴집'::text) $$,
  '쿠폰 가게가 맨 위, 그다음 내 학생회 제휴가 가까운 순(앱에 숨긴 학생회 행은 쓰지 않는다)');
select is((select partner from t_a where who = 'computing' and name = '소융 제휴집'), false, '학생회 제휴는 "광고"가 아니다');
select is((select council_college from t_a where who = 'computing' and name = '소융 제휴집'), 'computing', '어느 학생회 제휴인지 온다');
select is((select council_text from t_a where who = 'computing' and name = '소융 제휴집'), '인원수만큼 만두',
  '혜택은 첫 줄만(괄호만 있는 줄과 앞 번호는 뗀다)');
select is((select council_college from t_a where who = 'computing' and name = '총학 제휴집'), 'all', '총학생회 제휴도 온다');
select is((select max(total_count) from t_a where who = 'computing'), 6, '맞는 가게 수가 같이 와서 "더 보기"를 그린다');
select is((select max(menu_name) from t_a where who = 'computing'), 'z48짜장', '"더 보기"에 쓸 메뉴 이름이 온다');
select is((select max(menu_cuisine) from t_a where who = 'computing'), 'chinese', '메뉴 종류도 온다');
select is((select coupon_text from t_a where who = 'computing' and name = '쿠폰집'), '밥BTI 보여 주면 만두', '쿠폰 가게는 쿠폰 문구 그대로');

-- 공대 사람: 다른 참여자(소융대)의 단과대는 쓰지 않는다
select results_eq($$ select name from t_a where who = 'eng' order by pos $$,
  $$ values ('쿠폰집'::text), ('공대 제휴집'::text), ('총학 제휴집'::text) $$,
  '같은 판이어도 부른 사람 자신의 단과대 제휴만 위로 온다');
select is((select count(*)::int from t_a where who = 'eng' and council_college = 'computing'), 0,
  '같은 판 소융대 사람의 제휴는 공대 사람에게 오지 않는다');
select is((select count(*)::int from t_a where who = 'computing' and council_college = 'eng'), 0,
  '같은 판 공대 사람의 제휴는 소융대 사람에게 오지 않는다');

-- 단과대를 말하지 않은 사람: 총학생회 제휴만
select results_eq($$ select name from t_a where who = 'none' order by pos $$,
  $$ values ('쿠폰집'::text), ('총학 제휴집'::text), ('z48짜장 전문'::text) $$,
  '단과대가 없으면 총학생회 제휴만 위로, 그다음 이름에 메뉴가 있는 곳(가까운 집보다 먼저)');
select is((select match from t_a where who = 'none' and name = 'z48짜장 전문'), 'menu', '이름에 메뉴가 있으면 메뉴가 맞는 곳');

-- 카페도 같은 순서
select results_eq($$ select name from t_c order by pos $$,
  $$ values ('카페 쿠폰'::text), ('카페 소융 제휴'::text), ('카페 가까움'::text) $$,
  '카페도 쿠폰 카페, 학생회 제휴, 가까운 순');
select is((select partner from t_c where name = '카페 소융 제휴'), false, '혜택 문구 없는 제휴 카페는 "광고"가 아니다');
select is((select council_text from t_c where name = '카페 소융 제휴'), '음료 500원 할인', '카페도 학생회 혜택 첫 줄이 온다');
select is((select max(total_count) from t_c), 4, '카페 수도 온다');

-- 첫 줄 뽑기와 함수 설정
select is(public.council_first_line(E'\n(중복 불가)\n2) 음료 1개\n3. 만두'), '음료 1개', '빈 줄과 괄호 줄을 건너뛰고 번호를 뗀다');
select is(public.council_first_line(null), null, '혜택이 없으면 null');
select is((select count(*)::int from pg_proc p where p.pronamespace = 'public'::regnamespace
  and p.proname in ('council_first_line', 'my_council_pick', 'session_cafes', 'session_restaurants')
  and 'search_path=""' = any (p.proconfig)), 4, '네 함수 모두 search_path를 비워 고정한다');
select ok(not has_function_privilege('anon', 'public.session_restaurants(uuid)', 'execute'), '로그인 전에는 부르지 못한다');

select * from finish();
rollback;
