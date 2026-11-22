-- AI 재료 추정 (명세 4-22, 0023): 태그 밖 값은 버림, 더하기만, 같은 이름은 저장한 값, 하루 상한, 참여자만
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'),  -- 올린 사람
  ('00000000-0000-0000-0000-0000000000a2'),  -- 해산물 못 먹음
  ('00000000-0000-0000-0000-0000000000a3');  -- 다른 모임
insert into public.groups (id, name, invite_code, created_by) values
  ('10000000-0000-0000-0000-0000000000a1', 'ai 모임', 'TESTAX', '00000000-0000-0000-0000-0000000000a1');
insert into public.memberships (group_id, user_id, display_name) values
  ('10000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1', '하나'),
  ('10000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2', '둘');
insert into public.restrictions (user_id, tag, food_id) values ('00000000-0000-0000-0000-0000000000a2', 'seafood', null);
insert into public.sessions (id, group_id, host_user_id) values
  ('20000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1');
create temp table t_ai (k text, r jsonb);
grant all on t_ai to authenticated;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
set local role authenticated;
select public.join_session('20000000-0000-0000-0000-0000000000a1');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
select public.join_session('20000000-0000-0000-0000-0000000000a1');
insert into t_ai select 'add', public.add_custom_candidate('20000000-0000-0000-0000-0000000000a1', 't분짜 특선');
insert into t_ai select 'req1', public.ai_ingredient_request((select (r->>'food_id')::bigint from t_ai where k = 'add'));
reset role;

select is((select r->>'action' from t_ai where k = 'req1'), 'ask', '저장한 값이 없으면 물어보라고 한다');
select is((select ai_status from public.foods where name = 't분짜 특선'), 'pending', '묻는 중으로 표시');
select is((select calls from public.ai_usage where day = (now() at time zone 'Asia/Seoul')::date), 1, '하루 호출 수를 센다');

select public.ai_ingredient_apply((select id from public.foods where name = 't분짜 특선'),
  array['seafood','halal','pork','gluten'], '{"seafood":"느억맘에 생선 소스","halal":"x","gluten":"y"}'::jsonb, 'test');
select is((select ai_tags from public.foods where name = 't분짜 특선'), array['pork','seafood'], '9개 밖 값은 버린다');
select is((select ai_notes from public.foods where name = 't분짜 특선'), '{"seafood":"느억맘에 생선 소스"}'::jsonb, '이유는 남긴 태그의 것만');
select ok((select 'seafood' = any (tags) from public.foods where name = 't분짜 특선'), 'AI 태그가 판정 태그에 더해진다');
select is((select vetoed from public.candidates c join public.foods f on f.id = c.food_id where f.name = 't분짜 특선'), true, '해산물 못 먹는 사람이 있으면 "못 먹는 사람이 있어요"');

select public.ai_ingredient_apply((select id from public.foods where name = 't분짜 특선'), array['egg'], '{}'::jsonb, 'test');
select ok((select tags @> array['pork','seafood','egg'] from public.foods where name = 't분짜 특선'), '더하기만 한다(앞 태그가 남는다)');

-- 같은 이름(공백 달라도)은 저장한 값을 바로 쓴다
insert into public.sessions (id, group_id, host_user_id) values
  ('20000000-0000-0000-0000-0000000000a2', '10000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1');
update public.sessions set status = 'done' where id = '20000000-0000-0000-0000-0000000000a1';
insert into public.foods (name, tags, cuisine, custom) values ('t분짜특선', '{}', 'custom', true);
insert into public.session_participants (session_id, user_id) values ('20000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a1');
insert into public.candidates (session_id, food_id, proposed_by) values
  ('20000000-0000-0000-0000-0000000000a2', (select id from public.foods where name = 't분짜특선'), '00000000-0000-0000-0000-0000000000a1');
set local role authenticated;
insert into t_ai select 'req2', public.ai_ingredient_request((select id from public.foods where name = 't분짜특선'));
reset role;
select is((select r->>'action' from t_ai where k = 'req2'), 'cached', '같은 이름은 AI를 부르지 않고 저장한 값');
select is((select ai_tags from public.foods where name = 't분짜특선'), array['pork','seafood'], '저장한 태그가 붙는다');

-- 참여자가 아니면 거절, 하루 상한을 넘으면 묻지 않는다
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select public.ai_ingredient_request((select id from public.foods where name = 't분짜특선')) $$,
  'P0001', 'not_participant', '그 메뉴가 후보인 판의 참여자만 부른다');
reset role;
update public.ai_usage set calls = public.app_limit('AI_DAILY_MAX') where day = (now() at time zone 'Asia/Seoul')::date;
insert into public.foods (name, tags, cuisine, custom) values ('t새메뉴', '{}', 'custom', true);
insert into public.candidates (session_id, food_id, proposed_by) values
  ('20000000-0000-0000-0000-0000000000a2', (select id from public.foods where name = 't새메뉴'), '00000000-0000-0000-0000-0000000000a1');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
insert into t_ai select 'req3', public.ai_ingredient_request((select id from public.foods where name = 't새메뉴'));
reset role;
select is((select r->>'reason' from t_ai where k = 'req3'), 'daily_limit', '하루 상한을 넘으면 낱말 표만');

select * from finish();
rollback;
