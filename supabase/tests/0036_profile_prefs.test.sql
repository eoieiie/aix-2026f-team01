-- 프로필 꾸미기, 취향, 맞춤 채우기 (0036, 명세 4-27)
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

-- 노트북과 CI에는 그림 파일 이름이 비어 있을 수 있어 여기서 채운다(0026은 씨앗보다 먼저 돈다)
update public.foods set image_path = id || '.webp' where not custom;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000b1'),  -- 중식 좋아함, 순한맛
  ('00000000-0000-0000-0000-0000000000b2'),  -- 같은 모임, 취향 없음
  ('00000000-0000-0000-0000-0000000000b3'),  -- 다른 모임
  ('00000000-0000-0000-0000-0000000000b4');  -- 프로필 없음
insert into public.profiles (user_id, display_name) values
  ('00000000-0000-0000-0000-0000000000b1', '하나'),
  ('00000000-0000-0000-0000-0000000000b2', '둘'),
  ('00000000-0000-0000-0000-0000000000b3', '셋');
insert into public.groups (id, name, invite_code, created_by) values
  ('10000000-0000-0000-0000-0000000000b1', '취향 모임', 'PREFAB', '00000000-0000-0000-0000-0000000000b1'),
  ('10000000-0000-0000-0000-0000000000b2', '남의 모임', 'PREFCD', '00000000-0000-0000-0000-0000000000b3');
insert into public.memberships (group_id, user_id, display_name) values
  ('10000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b1', '하나'),
  ('10000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2', '둘'),
  ('10000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000b3', '셋');
insert into public.sessions (id, group_id, host_user_id, status) values
  ('20000000-0000-0000-0000-0000000000b0', '10000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b1', 'done'),
  ('20000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b1', 'open'),
  ('20000000-0000-0000-0000-0000000000b2', '10000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000b3', 'open');
insert into public.session_participants (session_id, user_id) values
  ('20000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b1'),
  ('20000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2'),
  ('20000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000b3');
-- 하나는 한 끼를 먹었다(레벨 1). 먹은 것은 줄의 맨 끝 메뉴
insert into public.meals (id, group_id, session_id, food_id, eaten_at) values
  ('30000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-0000000000b1', '20000000-0000-0000-0000-0000000000b0',
   (select id from public.foods where not custom order by id desc limit 1), now());
insert into public.meal_participants (meal_id, user_id) values
  ('30000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b1');

set local role authenticated;

-- 프로필이 없으면 저장하지 못한다
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b4","role":"authenticated"}', true);
select throws_ok($$ select public.save_my_prefs('{"spice_level":1}'::jsonb) $$, 'P0001', 'display_name_required',
  '이름을 적기 전에는 취향을 저장하지 못한다');

-- 하나: 취향 저장과 읽기
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is(
  public.save_my_prefs('{"fav_cuisines":["chinese"],"spice_level":0,"college":"computing","budget_level":2,"meal_times":["lunch"]}'::jsonb) -> 'fav_cuisines',
  '["chinese"]'::jsonb, '좋아하는 종류를 저장한다');
select is(public.my_prefs() ->> 'college', 'computing', '단과대를 읽는다');
select throws_ok($$ select public.save_my_prefs('{"fav_cuisines":["martian"]}'::jsonb) $$, 'P0001', 'prefs_invalid',
  '목록에 없는 종류는 거절한다');
select throws_ok($$ select public.save_my_prefs('{"spice_level":9}'::jsonb) $$, 'P0001', 'prefs_invalid',
  '매운맛은 0~3만 받는다');
select throws_ok($$ select public.save_my_prefs('{"college":"없는대학"}'::jsonb) $$, 'P0001', 'prefs_invalid',
  '목록에 없는 단과대는 거절한다');
select is((public.save_my_prefs('{"college":null}'::jsonb) -> 'college')::text, 'null', '말하지 않기를 고르면 단과대를 지운다');
select is(public.my_prefs() ->> 'spice_level', '0', '넘기지 않은 칸은 그대로 둔다');

-- 아바타: 처음 6개, 레벨만큼 더, 먹어 본 메뉴
select lives_ok($$ select public.save_my_prefs(jsonb_build_object('avatar_food_id',
  (select id from public.foods where not custom order by id limit 1))) $$, '처음부터 열린 아바타는 고를 수 있다');
select throws_ok($$ select public.save_my_prefs(jsonb_build_object('avatar_food_id',
  (select id from public.foods where not custom order by id offset 19 limit 1))) $$, 'P0001', 'avatar_locked',
  '아직 안 열린 아바타는 고르지 못한다');
select lives_ok($$ select public.save_my_prefs(jsonb_build_object('avatar_food_id',
  (select id from public.foods where not custom order by id desc limit 1))) $$, '먹어 본 메뉴는 레벨과 상관없이 열린다');
select is((select count(*)::int from public.my_avatar_options() where unlocked), 8,
  '레벨 1이면 처음 6개와 레벨 1개, 먹어 본 1개가 열려 있다');

-- 같은 모임 사람은 아바타만 본다
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select is((select count(*)::int from public.visible_avatars() where user_id = '00000000-0000-0000-0000-0000000000b1'), 1,
  '같은 모임 사람의 아바타가 보인다');
select is((select count(*)::int from public.profiles where user_id = '00000000-0000-0000-0000-0000000000b1'), 0,
  '다른 사람의 취향과 단과대는 읽지 못한다');

-- 맞춤 채우기: 중식을 좋아하고 순한맛인 사람이 있으면 안 매운 중식이 먼저
select is((select count(*)::int from public.session_fill_picks('20000000-0000-0000-0000-0000000000b1', 2) p
  join public.foods f on f.id = p.food_id where f.name in ('짜장면', '탕수육')), 2,
  '좋아하는 종류이고 안 매운 메뉴가 먼저 나온다');

-- 다른 모임 사람
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b3","role":"authenticated"}', true);
select is((select count(*)::int from public.visible_avatars() where user_id = '00000000-0000-0000-0000-0000000000b1'), 0,
  '모임도 식사도 겹치지 않으면 아바타가 보이지 않는다');
select throws_ok($$ select * from public.session_fill_picks('20000000-0000-0000-0000-0000000000b1') $$, 'P0001', 'not_member',
  '판 참여자가 아니면 채우기 추천을 받지 못한다');
select is((select count(*)::int from public.session_fill_picks('20000000-0000-0000-0000-0000000000b2')), 0,
  '아무도 취향을 안 적은 판은 0줄(앱이 예전처럼 무작위로 채운다)');

-- 못 먹는 것 제외는 그대로: 둘이 돼지고기를 못 먹으면 돼지고기 메뉴는 나오지 않는다
reset role;
insert into public.restrictions (user_id, tag, food_id) values ('00000000-0000-0000-0000-0000000000b2', 'pork', null);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select is((select count(*)::int from public.session_fill_picks('20000000-0000-0000-0000-0000000000b1', 10) p
  join public.foods f on f.id = p.food_id where 'pork' = any (f.tags)), 0,
  '못 먹는 사람이 있는 메뉴는 취향 점수가 높아도 나오지 않는다');

-- 계정을 지우면 아바타, 단과대, 취향도 같이 지워진다
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select public.delete_my_account();
reset role;
select is((select count(*)::int from public.profiles where user_id = '00000000-0000-0000-0000-0000000000b1'), 0,
  '계정 삭제 뒤 프로필 줄(아바타, 단과대, 취향)이 남지 않는다');

select * from finish();
rollback;
