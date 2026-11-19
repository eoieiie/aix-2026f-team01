-- 먹고 나서 카페 (명세 4-23, 0020)
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000000001'),  -- 방장
  ('00000000-0000-0000-0000-000000000003');  -- 다른 모임
insert into public.foods (name, tags, cuisine) values ('c국수', array[]::text[], 'korean');
-- 시험용 동네(c_test). 정문에서 가까운 순: 가까운집 < 중간집 < 먼집, 제휴집은 가장 멀지만 먼저
insert into public.restaurants (area, name, cuisine, menus, lat, lng, partner, coupon_text, source_id) values
  ('c_test', '먼집 커피', 'cafe', '{}', 37.3080, 126.8369, false, null, 'tc/1'),
  ('c_test', '가까운집 커피', 'cafe', '{}', 37.2999, 126.8369, false, null, 'tc/2'),
  ('c_test', '중간집 커피', 'cafe', '{}', 37.3020, 126.8369, false, null, 'tc/3'),
  ('c_test', '제휴 카페', 'cafe', '{}', 37.3090, 126.8369, true, '밥BTI 보여 주면 아메리카노 500원 할인', 'tc/4'),
  ('c_test', '한식당 c국수', 'korean', '{}', 37.2998, 126.8369, false, null, 'tc/5');
insert into public.groups (id, name, invite_code, created_by, area) values
  ('10000000-0000-0000-0000-0000000000c1', '카페 모임', 'TESTCF', '00000000-0000-0000-0000-000000000001', 'c_test');
insert into public.memberships (group_id, user_id, display_name) values
  ('10000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000001', '하나');
insert into public.sessions (id, group_id, host_user_id, status, decided_food_id) values
  ('20000000-0000-0000-0000-0000000000c1', '10000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000001', 'done',
   (select id from public.foods where name = 'c국수'));

create temp table t_c as select * from public.session_cafes('20000000-0000-0000-0000-0000000000c1') limit 0;
create temp table t_r as select id, name from public.restaurants limit 0;
grant all on t_c, t_r to authenticated;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select * from public.session_cafes('20000000-0000-0000-0000-0000000000c1') $$,
  'P0001', 'not_member', '다른 모임 사람은 카페를 받지 못한다');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
insert into t_c select * from public.session_cafes('20000000-0000-0000-0000-0000000000c1');
insert into t_r select r.id, r.name from public.session_restaurants('20000000-0000-0000-0000-0000000000c1') r;
reset role;

select is((select count(*)::int from t_c), 3, '카페는 3곳까지');
select is((select name from t_c limit 1), '제휴 카페', '제휴 카페가 먼저');
select is((select coupon_text from t_c where name = '제휴 카페'), '밥BTI 보여 주면 아메리카노 500원 할인', '제휴 카페만 쿠폰 문구');
select results_eq($$ select name from t_c where not partner $$, $$ values ('가까운집 커피'::text), ('중간집 커피'::text) $$,
  '나머지는 정문에서 가까운 순');
select is((select count(*)::int from t_r where name like '%커피' or name = '제휴 카페'), 0, '카페는 "이 메뉴 파는 학교 앞" 칸에 섞이지 않는다');
select ok((select count(*) from public.restaurants where cuisine = 'cafe' and area = 'erica') >= 10, 'ERICA 카페 데이터가 들어갔다');

select * from finish();
rollback;
