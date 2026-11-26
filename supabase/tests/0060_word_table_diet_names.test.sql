-- 0060 낱말 표 오발: 식단 이름은 고기, 해산물, 유제품, 달걀을 약함으로, 짧은 낱말 오발 막기 (명세 4-7, 4-9)
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- 짧은 낱말 오발 막기
select ok(not ('seafood' = any (public.guess_food_tags('굴라쉬'))), '굴라쉬의 굴은 해산물이 아니다');
select ok(not ('seafood' = any (public.guess_food_tags('굴라시 수프'))), '굴라시도 같다');
select ok(not ('seafood' = any (public.guess_food_tags('회과육'))), '회과육의 회는 날생선이 아니다');
select ok(not ('pork' = any (public.guess_food_tags('돼지감자 볶음'))), '돼지감자는 채소');
select ok('seafood' = any (public.guess_food_tags('굴국밥')), '굴국밥은 그대로 해산물');
select ok('seafood' = any (public.guess_food_tags('물회')), '물회는 그대로 해산물');

-- 식단 이름 판단
select ok(public.food_diet_name('비건 라멘'), '비건');
select ok(public.food_diet_name('채식만두'), '채식(붙여 써도)');
select ok(public.food_diet_name('콩고기 불고기'), '콩고기');
select ok(public.food_diet_name('VEGAN Burger'), '영어는 대소문자 없이');
select ok(not public.food_diet_name('야채 식빵'), '야채식의 채식은 식단이 아니다');
select ok(not public.food_diet_name('김치만두'), '식단 낱말 없음');

-- 식단 이름이면 고기, 해산물, 유제품, 달걀은 약함으로 내린다(지우지 않는다). 밀은 그대로 확실
select is(public.guess_food_tags('비건 라멘'), '{wheat}'::text[], '비건 라멘: 확실은 밀만');
select ok(public.guess_food_soft_tags('비건 라멘') @> '{egg,pork}'::text[], '비건 라멘: 돼지고기와 달걀은 약함');
select is(public.guess_food_tags('채식 만두'), '{wheat}'::text[], '채식 만두: 확실은 밀만');
select ok('pork' = any (public.guess_food_soft_tags('채식 만두')), '채식 만두: 돼지고기는 약함');
select is(public.guess_food_tags('콩고기 불고기'), '{}'::text[], '콩고기 불고기: 확실 없음');
select ok('beef' = any (public.guess_food_soft_tags('콩고기 불고기')), '콩고기 불고기: 소고기는 약함');
select ok(public.guess_food_soft_tags('비건 크림 파스타') @> '{dairy}'::text[], '비건 크림 파스타: 유제품은 약함');
select ok('pork' = any (public.guess_food_tags('김치만두')), '식단 이름이 아니면 그대로 확실');
select ok('wheat' = any (public.guess_food_tags('비건 버거')), '식단 이름이어도 밀은 확실');

-- 판에서: 할랄인 사람이 있어도 채식 만두는 "못 먹는 사람이 있어요"가 아니라 "들어갈 수 있어요"
insert into auth.users (id) values ('00000000-0000-0000-0000-0000000060c1'), ('00000000-0000-0000-0000-0000000060c2');
insert into public.groups (id, name, invite_code, created_by) values
  ('10000000-0000-0000-0000-0000000060c1', '식단 이름 모임', 'TESTDW', '00000000-0000-0000-0000-0000000060c1');
insert into public.memberships (group_id, user_id, display_name) values
  ('10000000-0000-0000-0000-0000000060c1', '00000000-0000-0000-0000-0000000060c1', '하나'),
  ('10000000-0000-0000-0000-0000000060c1', '00000000-0000-0000-0000-0000000060c2', '둘');
insert into public.restrictions (user_id, tag, food_id) values ('00000000-0000-0000-0000-0000000060c2', 'halal', null);
insert into public.sessions (id, group_id, host_user_id) values
  ('20000000-0000-0000-0000-0000000060c1', '10000000-0000-0000-0000-0000000060c1', '00000000-0000-0000-0000-0000000060c1');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000060c2","role":"authenticated"}', true);
set local role authenticated;
select public.join_session('20000000-0000-0000-0000-0000000060c1');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000060c1","role":"authenticated"}', true);
set local role authenticated;
select public.join_session('20000000-0000-0000-0000-0000000060c1');
select public.add_custom_candidate('20000000-0000-0000-0000-0000000060c1', '채식 만두');
select public.add_custom_candidate('20000000-0000-0000-0000-0000000060c1', '김치만두 세트');
reset role;

select is((select c.vetoed from public.candidates c join public.foods f on f.id = c.food_id
  where c.session_id = '20000000-0000-0000-0000-0000000060c1' and f.name = '채식 만두'), false, '채식 만두는 할랄에 확실 경고가 없다');
select is((select c.maybe_tags from public.candidates c join public.foods f on f.id = c.food_id
  where c.session_id = '20000000-0000-0000-0000-0000000060c1' and f.name = '채식 만두'), '{pork}'::text[], '채식 만두는 돼지고기 들어갈 수 있어요');
select is((select c.vetoed from public.candidates c join public.foods f on f.id = c.food_id
  where c.session_id = '20000000-0000-0000-0000-0000000060c1' and f.name = '김치만두 세트'), true, '김치만두는 그대로 확실 경고');

select * from finish();
rollback;
