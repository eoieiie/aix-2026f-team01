-- 못 먹는 것 정리: 이유 빼기, 달걀 태그, 기본 음식 태그 (명세 4-7, 0007, 0014, 이슈 #39)
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- 이유는 저장하지 않는다 -----------------------------------------------------
select hasnt_column('public', 'restrictions', 'kind', 'restrictions에 이유 칸이 없다');

insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000000001'),  -- 방장
  ('00000000-0000-0000-0000-000000000002');  -- 달걀 못 먹음
insert into public.foods (name, tags) values ('r_egg', array['egg']), ('r_plain', array['wheat']);
insert into public.groups (id, name, invite_code, created_by) values
  ('10000000-0000-0000-0000-000000000001', '정리 모임', 'TESTRC', '00000000-0000-0000-0000-000000000001');
insert into public.memberships (group_id, user_id, display_name) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '하나'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '둘');
insert into public.sessions (id, group_id, host_user_id) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ select public.set_my_restrictions('[{"tag":"seafood","kind":"allergy"}]') $$,
  '이 PR 전의 앱처럼 kind를 보내도 저장된다');
select lives_ok(
  $$ select public.set_my_restrictions(jsonb_build_array(
       jsonb_build_object('tag', 'egg'),
       jsonb_build_object('food_id', (select id from public.foods where name = 'r_plain')))) $$,
  'kind 없이 저장된다. 달걀 태그도 받는다');
select results_eq(
  $$ select tag, food_id from public.get_my_restrictions() $$,
  $$ values ('egg'::text, null::bigint), (null::text, (select id from public.foods where name = 'r_plain')) $$,
  'get_my_restrictions는 태그와 음식만 돌려준다');
reset role;

-- 달걀 태그 -----------------------------------------------------------------
select ok('egg' = any (public.ingredient_tags()), '재료 태그에 달걀이 있다');
select is(public.restriction_blocks(1, array['egg'], 'egg', null), true, '달걀을 등록하면 달걀이 든 음식이 걸린다');
select is(public.restriction_blocks(1, array['egg'], 'vegan', null), true, '비건: 달걀도 걸린다 (0014)');
select is(public.restriction_blocks(1, array['egg'], 'vegetarian', null), false, '채식: 달걀은 걸리지 않는다');

-- 판에서: 달걀을 못 먹는 사람이 들어오면 달걀 후보에 "못 먹는 사람이 있어요"가 붙는다
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select public.join_session('20000000-0000-0000-0000-000000000001');
select public.add_candidate('20000000-0000-0000-0000-000000000001', (select id from public.foods where name = 'r_egg'));
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select public.join_session('20000000-0000-0000-0000-000000000001');
reset role;
select is(
  (select vetoed from public.candidates
   where session_id = '20000000-0000-0000-0000-000000000001'
     and food_id = (select id from public.foods where name = 'r_egg')),
  true, '달걀을 못 먹는 사람이 들어오면 달걀 후보가 걸린다');

-- 기본 음식 태그 (seed, 0007) ------------------------------------------------
select ok((select tags @> array['beef', 'egg'] and not tags @> array['veg_ok'] from public.foods where name = '비빔밥'),
  '비빔밥: 소고기와 달걀이 있고 채식 표시가 없다');
select ok((select not tags @> array['halal_ok'] from public.foods where name = '인도 커리'),
  '인도 커리: 할랄 표시가 없다');
select ok((select not tags @> array['halal_ok'] from public.foods where name = '케밥'),
  '케밥: 할랄 표시가 없다');
select ok((select tags @> array['nuts', 'wheat'] from public.foods where name = '마라탕'),
  '마라탕: 견과류와 밀가루가 있다');
select ok((select tags @> array['seafood', 'wheat', 'egg'] from public.foods where name = '김밥'),
  '김밥: 해산물(어묵), 밀가루, 달걀이 있다');
select is((select count(*)::int from public.foods where not custom and name not in ('r_egg', 'r_plain')), 40,
  '기본 음식은 40개 그대로다');
select is(
  (select count(*)::int from public.foods
   where not custom and tags @> array['halal_ok'] and tags && array['pork', 'beef', 'chicken']),
  0, '고기가 든 기본 음식에는 할랄 표시가 없다');

select * from finish();
rollback;
