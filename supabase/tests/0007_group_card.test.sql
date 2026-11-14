-- 모임 프로필 카드(4-16): 인원수만 돌려주고, 3명 미만이면 숫자를 숨긴다.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000003'),
  ('00000000-0000-0000-0000-000000000004');  -- 모임 밖 사람
insert into public.profiles (user_id, display_name, quiz_answers, axes) values
  ('00000000-0000-0000-0000-000000000001', '하나', '["A","A","A","A","A","A","A","A"]', '{"explore": 1, "spicy": 1, "korean": 1, "lead": 1}'),
  ('00000000-0000-0000-0000-000000000002', '둘', '["B","B","B","B","B","B","B","B"]', '{"explore": -1, "spicy": -1, "korean": -1, "lead": -1}'),
  ('00000000-0000-0000-0000-000000000003', '셋', null, null),
  ('00000000-0000-0000-0000-000000000004', '넷', '["A","A","A","A","A","A","A","A"]', '{"explore": 1, "spicy": 1, "korean": 1, "lead": 1}');
insert into public.foods (name, tags) values ('t_a', array[]::text[]), ('t_b', array[]::text[]);

insert into public.groups (id, name, invite_code, created_by) values
  ('10000000-0000-0000-0000-000000000001', '세 명', 'TESTAB', '00000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002', '두 명', 'TESTCD', '00000000-0000-0000-0000-000000000001');
insert into public.memberships (group_id, user_id, display_name) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '하나'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '둘'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', '셋'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '하나'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', '둘');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

-- 못 먹는 것을 아무도 등록하지 않았을 때 ------------------------------------
select is(
  public.group_profile_card('10000000-0000-0000-0000-000000000001') -> 'tag_counts',
  '[]'::jsonb, '등록한 사람이 없으면 빈 목록');
select is(
  (public.group_profile_card('10000000-0000-0000-0000-000000000001') ->> 'food_block_count')::int,
  0, '음식을 지정한 사람이 없으면 0');
reset role;

insert into public.restrictions (user_id, tag, food_id)
select v.u::uuid, v.t, (select id from public.foods where name = v.f)
from (values
  ('00000000-0000-0000-0000-000000000001', 'pork', null),
  ('00000000-0000-0000-0000-000000000002', 'pork', null),
  ('00000000-0000-0000-0000-000000000003', 'nuts', null),
  ('00000000-0000-0000-0000-000000000003', 'halal', null),
  ('00000000-0000-0000-0000-000000000004', 'pork', null),
  ('00000000-0000-0000-0000-000000000004', 'seafood', null),
  ('00000000-0000-0000-0000-000000000001', null, 't_a'),
  ('00000000-0000-0000-0000-000000000001', null, 't_b'),
  ('00000000-0000-0000-0000-000000000004', null, 't_a')
) as v (u, t, f);

-- 소속 3명, 테스트한 사람 2명 -----------------------------------------------
set local role authenticated;
select is(
  public.group_profile_card('10000000-0000-0000-0000-000000000001'),
  '{"member_count": 3,
    "tag_counts": [{"tag": "pork", "count": 2}, {"tag": "halal", "count": 1}, {"tag": "nuts", "count": 1}],
    "food_block_count": 1,
    "tested_count": 2,
    "axes": null}'::jsonb,
  '태그는 많은 순, 같으면 코드 순. 모임 밖 사람은 세지 않는다. 음식은 사람 수로 센다. 테스트한 사람이 2명이면 축은 null');
reset role;

-- 소속 3명, 테스트한 사람 3명 -----------------------------------------------
update public.profiles
set quiz_answers = '["A","A","A","A","A","A","B","B"]', axes = '{"explore": 1, "spicy": 1, "korean": 1, "lead": -1}'
where user_id = '00000000-0000-0000-0000-000000000003';

set local role authenticated;
select is(
  public.group_profile_card('10000000-0000-0000-0000-000000000001') -> 'axes',
  '{"explore": 0.33, "spicy": 0.33, "korean": 0.33, "lead": -0.33}'::jsonb,
  '테스트한 사람이 3명이면 축별 평균, 소수 둘째 자리');
select is(
  (public.group_profile_card('10000000-0000-0000-0000-000000000001') ->> 'tested_count')::int,
  3, '테스트한 사람 수');
select unalike(
  public.group_profile_card('10000000-0000-0000-0000-000000000001')::text,
  '%00000000-0000-0000-0000-00000000000%', '결과에 user_id가 없다');
select ok(
  not (public.group_profile_card('10000000-0000-0000-0000-000000000001') ? 'user_id'),
  '결과에 user_id 칸이 없다');

-- 소속 2명 ------------------------------------------------------------------
select is(
  public.group_profile_card('10000000-0000-0000-0000-000000000002'),
  '{"member_count": 2, "tag_counts": null, "food_block_count": null, "tested_count": 2, "axes": null}'::jsonb,
  '소속이 2명이면 못 먹는 것 숫자와 축이 null');
reset role;

-- 소속이 아닐 때 -------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ select public.group_profile_card('10000000-0000-0000-0000-000000000001') $$,
  'P0001', 'not_member', '소속이 아니면 거절');
select throws_ok(
  $$ select public.group_profile_card('10000000-0000-0000-0000-000000000099') $$,
  'P0001', 'not_member', '없는 모임도 같은 코드');
select is((select count(*)::int from public.restrictions where user_id <> '00000000-0000-0000-0000-000000000004'), 0, '다른 사람의 못 먹는 것은 표로도 안 보인다');
reset role;

select ok(
  not has_function_privilege('anon', 'public.group_profile_card(uuid)', 'execute'),
  '로그인하지 않으면 부를 수 없다');
select ok(
  has_function_privilege('authenticated', 'public.group_profile_card(uuid)', 'execute'),
  '로그인하면 부를 수 있다');

select * from finish();
rollback;
