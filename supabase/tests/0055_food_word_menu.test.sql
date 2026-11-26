-- 0055 넓은 음식 이름은 메뉴로, 가게 이름은 그대로 태그 없음 (명세 4-22, 사람 정답표)
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

select is(public.ai_rule('AI_PROMPT_VERSION'), 3, '프롬프트 판 3');

-- 음식 낱말: 이름 전체가 음식 낱말과 같을 때만
select ok(public.ai_is_food_word('빵'), '빵은 음식 낱말');
select ok(public.ai_is_food_word(' 국수 🍜'), '정제한 뒤 국수는 음식 낱말');
select ok(public.ai_is_food_word('떡'), '떡은 음식 낱말');
select ok(public.ai_is_food_word('고기'), '고기는 음식 낱말');
select ok(not public.ai_is_food_word('찌개찌개'), '낱말이 들어 있기만 한 가게 이름은 아니다');
select ok(not public.ai_is_food_word('보배반점'), '중국집 가게 이름은 아니다');
select ok(not public.ai_is_food_word('병천순대'), '순대 가게 이름은 아니다');
select ok(not public.ai_is_food_word('백소정'), '브랜드 이름은 아니다');
select ok(not public.ai_is_food_word(''), '빈 이름은 아니다');

-- 판: c1 올린 사람, c2 비건
insert into auth.users (id) values ('00000000-0000-0000-0000-0000000055c1'), ('00000000-0000-0000-0000-0000000055c2');
insert into public.groups (id, name, invite_code, created_by) values
  ('10000000-0000-0000-0000-0000000055c1', '음식 낱말 모임', 'TEST55', '00000000-0000-0000-0000-0000000055c1');
insert into public.memberships (group_id, user_id, display_name) values
  ('10000000-0000-0000-0000-0000000055c1', '00000000-0000-0000-0000-0000000055c1', '하나'),
  ('10000000-0000-0000-0000-0000000055c1', '00000000-0000-0000-0000-0000000055c2', '둘');
insert into public.restrictions (user_id, tag, food_id) values ('00000000-0000-0000-0000-0000000055c2', 'vegan', null);
insert into public.sessions (id, group_id, host_user_id) values
  ('20000000-0000-0000-0000-0000000055c1', '10000000-0000-0000-0000-0000000055c1', '00000000-0000-0000-0000-0000000055c1');
create temp table t55 (k text, r jsonb);
grant all on t55 to authenticated;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000055c2","role":"authenticated"}', true);
set local role authenticated;
select public.join_session('20000000-0000-0000-0000-0000000055c1');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000055c1","role":"authenticated"}', true);
set local role authenticated;
select public.join_session('20000000-0000-0000-0000-0000000055c1');
insert into t55 select 'bread', public.add_custom_candidate('20000000-0000-0000-0000-0000000055c1', '빵');
insert into t55 select 'shop', public.add_custom_candidate('20000000-0000-0000-0000-0000000055c1', '보배반점');
insert into t55 select 'req_bread', public.ai_ingredient_request((select (r->>'food_id')::bigint from t55 where k = 'bread'));
insert into t55 select 'req_shop', public.ai_ingredient_request((select (r->>'food_id')::bigint from t55 where k = 'shop'));
reset role;

select is((select r->>'action' from t55 where k = 'req_bread'), 'ask', '빵은 AI에게 묻는다');
select is((select (r->>'food_word')::boolean from t55 where k = 'req_bread'), true, '빵을 물을 때 음식 낱말이라고 알린다');
select is((select (r->>'food_word')::boolean from t55 where k = 'req_shop'), false, '가게 이름은 음식 낱말이 아니다');

-- 안전망: 음식 낱말인데 모델이 메뉴 아님이라 해도 메뉴로 둔다
select public.ai_ingredient_apply((select (r->>'food_id')::bigint from t55 where k = 'bread'),
  '{}'::text[], '{}'::jsonb, 'test', '{}'::jsonb, false, public.ai_rule('AI_PROMPT_VERSION'), 0);
select is((select ai_status from public.foods where name = '빵' and custom), 'done', '빵은 메뉴 아님이 되지 않는다');

-- 가게 이름은 지금처럼 메뉴 아님, 태그 없음
select public.ai_ingredient_apply((select (r->>'food_id')::bigint from t55 where k = 'shop'),
  array['seafood'], '{"seafood":"짬뽕에 해산물"}'::jsonb, 'test', '{}'::jsonb, false, public.ai_rule('AI_PROMPT_VERSION'), 0);
select is((select ai_status from public.foods where name = '보배반점'), 'not_menu', '가게 이름은 그대로 메뉴 아님');
select is((select cardinality(c.maybe_tags) from public.candidates c join public.foods f on f.id = c.food_id
  where c.session_id = '20000000-0000-0000-0000-0000000055c1' and f.name = '보배반점'), 0, '가게 이름에는 약한 표시도 없다');

select * from finish();
rollback;
