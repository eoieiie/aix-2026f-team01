-- 내 추천: 참여 권한, 본인 자료만 읽기, 추천 순서 (0049)
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000004901'),
  ('00000000-0000-0000-0000-000000004902'),
  ('00000000-0000-0000-0000-000000004903');
insert into public.profiles (user_id, display_name, fav_cuisines) values
  ('00000000-0000-0000-0000-000000004901', '하나', '{}'),
  ('00000000-0000-0000-0000-000000004902', '둘', '{japanese}'),
  ('00000000-0000-0000-0000-000000004903', '셋', '{korean}');
insert into public.groups (id, name, invite_code, created_by) values
  ('10000000-0000-0000-0000-000000004901', '추천 시험', 'FPCJ29', '00000000-0000-0000-0000-000000004901');
insert into public.memberships (group_id, user_id, display_name) values
  ('10000000-0000-0000-0000-000000004901', '00000000-0000-0000-0000-000000004901', '하나'),
  ('10000000-0000-0000-0000-000000004901', '00000000-0000-0000-0000-000000004902', '둘'),
  ('10000000-0000-0000-0000-000000004901', '00000000-0000-0000-0000-000000004903', '셋');
insert into public.foods (name, tags, ai_tags, custom) values
  ('zz_mypick_투표', '{}', '{}', true),
  ('zz_mypick_식사', '{}', '{}', true),
  ('zz_mypick_다른사람', '{}', '{}', true),
  ('zz_mypick_결과', '{}', '{}', true);
insert into public.sessions (id, group_id, host_user_id, status, decided_food_id) values
  ('20000000-0000-0000-0000-000000004901', '10000000-0000-0000-0000-000000004901', '00000000-0000-0000-0000-000000004901', 'open', null),
  ('20000000-0000-0000-0000-000000004902', '10000000-0000-0000-0000-000000004901', '00000000-0000-0000-0000-000000004901', 'done', (select id from public.foods where name = 'zz_mypick_결과')),
  ('20000000-0000-0000-0000-000000004903', '10000000-0000-0000-0000-000000004901', '00000000-0000-0000-0000-000000004901', 'done', null);
insert into public.session_participants (session_id, user_id) values
  ('20000000-0000-0000-0000-000000004901', '00000000-0000-0000-0000-000000004901'),
  ('20000000-0000-0000-0000-000000004901', '00000000-0000-0000-0000-000000004902'),
  ('20000000-0000-0000-0000-000000004902', '00000000-0000-0000-0000-000000004901'),
  ('20000000-0000-0000-0000-000000004902', '00000000-0000-0000-0000-000000004903');
insert into public.candidates (session_id, food_id, proposed_by)
select '20000000-0000-0000-0000-000000004902', id, '00000000-0000-0000-0000-000000004901' from public.foods
where name in ('zz_mypick_투표', 'zz_mypick_다른사람', 'zz_mypick_결과');
insert into public.votes (session_id, food_id, user_id)
select '20000000-0000-0000-0000-000000004902', id,
  case when name = 'zz_mypick_투표' then '00000000-0000-0000-0000-000000004901'::uuid else '00000000-0000-0000-0000-000000004903'::uuid end
from public.foods where name in ('zz_mypick_투표', 'zz_mypick_다른사람');
insert into public.meals (id, group_id, session_id, food_id, eaten_at)
select '30000000-0000-0000-0000-000000004901', '10000000-0000-0000-0000-000000004901',
  '20000000-0000-0000-0000-000000004903', id, now() - interval '13 days'
from public.foods where name = 'zz_mypick_식사';
insert into public.meal_participants (meal_id, user_id) values
  ('30000000-0000-0000-0000-000000004901', '00000000-0000-0000-0000-000000004901');

select ok(not has_function_privilege('anon', 'public.my_food_picks(uuid, int)', 'execute'), '미로그인 호출 권한이 없다');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000004903","role":"authenticated"}', true);
select throws_ok($$ select * from public.my_food_picks('20000000-0000-0000-0000-000000004901') $$, 'P0001', 'not_participant', '같은 모임이어도 판 참여자가 아니면 못 부른다');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000004902","role":"authenticated"}', true);
select is((select count(*)::int from public.my_food_picks('20000000-0000-0000-0000-000000004901', 3) p join public.foods f on f.id = p.food_id where f.cuisine = 'japanese'), 3, '새 사용자는 자기 좋아하는 종류를 먼저 받는다');
select public.save_my_prefs('{"fav_cuisines":[]}');
select is_empty($$ select * from public.my_food_picks('20000000-0000-0000-0000-000000004901') $$, '본인 취향과 기록이 없으면 같은 판에 다른 사람 기록이 있어도 숨긴다');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000004901","role":"authenticated"}', true);
select is((select name from public.my_food_picks('20000000-0000-0000-0000-000000004901', 1)), 'zz_mypick_투표', '끝난 판에서 내 표를 쓴 메뉴가 우선이다');
select ok(exists (select 1 from public.my_food_picks('20000000-0000-0000-0000-000000004901') where name = 'zz_mypick_결과'), '내가 참여한 끝난 판의 결과 메뉴를 반영한다');
select is_empty($$ select 1 from public.my_food_picks('20000000-0000-0000-0000-000000004901', 10) where name = 'zz_mypick_다른사람' $$, '다른 사람이 찍은 직접 쓴 음식은 추천하지 않는다');
select is_empty($$ select 1 from public.my_food_picks('20000000-0000-0000-0000-000000004901', 10) where name = 'zz_mypick_식사' $$, '13일 전에 먹은 메뉴는 뒤로 간다');
reset role;
update public.meals set eaten_at = now() - interval '15 days' where id = '30000000-0000-0000-0000-000000004901';
insert into public.candidates (session_id, food_id, proposed_by)
select '20000000-0000-0000-0000-000000004901', id, '00000000-0000-0000-0000-000000004901' from public.foods where name = 'zz_mypick_투표';
insert into public.restrictions (user_id, tag, kind) values ('00000000-0000-0000-0000-000000004901', 'seafood', 'allergy');
update public.foods set tags = '{seafood}' where name = 'zz_mypick_결과';
set local role authenticated;
select ok(exists (select 1 from public.my_food_picks('20000000-0000-0000-0000-000000004901') where name = 'zz_mypick_식사'), '15일 전 식사는 최근 식사로 미루지 않는다');
select is_empty($$ select 1 from public.my_food_picks('20000000-0000-0000-0000-000000004901', 10) where name = 'zz_mypick_투표' $$, '이미 올린 후보는 추천하지 않는다');
select is_empty($$ select 1 from public.my_food_picks('20000000-0000-0000-0000-000000004901', 10) where name = 'zz_mypick_결과' $$, '확실히 못 먹는 음식은 추천하지 않는다');
reset role;
update public.foods set tags = '{}', ai_tags = '{seafood}' where name = 'zz_mypick_결과';
set local role authenticated;
select is((select name from public.my_food_picks('20000000-0000-0000-0000-000000004901', 1)), 'zz_mypick_식사', '추정만 걸리는 결과 메뉴는 뒤로 보낸다');
reset role;
select * from finish();
rollback;
