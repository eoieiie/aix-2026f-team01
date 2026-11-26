-- 0045 기본 메뉴와 낱말 표를 기준 정답에 맞춤: 확실(tags)과 약함(soft_tags) (명세 4-7, 4-9)
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

-- 기본 메뉴
select ok(not ((select tags from public.foods where name = '부대찌개') && array['dairy','beef','seafood']), '부대찌개: 치즈, 소고기, 해산물은 확실이 아니다');
select ok((select soft_tags from public.foods where name = '부대찌개') @> array['dairy','beef','seafood'], '부대찌개: 셋은 가게마다(약함)');
select ok(not ((select tags from public.foods where name = '샐러드') && array['egg','dairy']), '샐러드: 달걀과 유제품은 확실이 아니다');
select ok((select tags from public.foods where name = '햄버거') @> array['egg'] and not ((select tags from public.foods where name = '햄버거') && array['dairy']), '햄버거: 마요(달걀)는 확실, 치즈는 아님');
select ok((select tags from public.foods where name = '라면') @> array['seafood'], '라면: 스프 해물은 확실');
select ok((select soft_tags from public.foods where name = '규동') @> array['seafood'] and not ((select tags from public.foods where name = '규동') && array['seafood']), '규동: 가쓰오 다시는 약함으로만(사람 확인 전)');
select ok((select tags from public.foods where name = '콩국수') @> array['veg_ok','vegan_ok'], '식단 짝 표시는 그대로');
select is((select count(*)::int from public.foods where not custom and tags && soft_tags), 0, '확실과 약함은 겹치지 않는다');
select throws_ok($$ update public.foods set soft_tags = array['gold'] where name = '라면' $$, '23514', null, '9개 밖 약한 태그는 거절');

-- 낱말 표
select ok(not ('beef' = any (public.guess_food_tags('갈비탕'))), '갈비는 소인지 돼지인지 이름만으로 모른다');
select ok(public.guess_food_soft_tags('갈비탕') @> array['beef','pork'], '갈비는 약함');
select ok('pork' = any (public.guess_food_tags('돼지갈비')), '돼지갈비는 돼지가 확실로 잡는다');
select ok(not ('beef' = any (public.guess_food_tags('치킨버거'))), '치킨버거에 소고기 확실 없음');
select ok(not ('wheat' = any (public.guess_food_tags('베트남 쌀면'))), '쌀면에 밀 없음');
select ok(not ('beef' = any (public.guess_food_tags('연어스테이크'))), '연어스테이크에 소고기 없음');

-- 판: c1 올린 사람, c2 유제품 못 먹음, c3 할랄
insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000045c1'), ('00000000-0000-0000-0000-0000000045c2'), ('00000000-0000-0000-0000-0000000045c3');
insert into public.groups (id, name, invite_code, created_by) values
  ('10000000-0000-0000-0000-0000000045c1', '기준 정답 모임', 'TESTAD', '00000000-0000-0000-0000-0000000045c1');
insert into public.memberships (group_id, user_id, display_name) values
  ('10000000-0000-0000-0000-0000000045c1', '00000000-0000-0000-0000-0000000045c1', '하나'),
  ('10000000-0000-0000-0000-0000000045c1', '00000000-0000-0000-0000-0000000045c2', '둘'),
  ('10000000-0000-0000-0000-0000000045c1', '00000000-0000-0000-0000-0000000045c3', '셋');
insert into public.restrictions (user_id, tag, food_id) values
  ('00000000-0000-0000-0000-0000000045c2', 'dairy', null),
  ('00000000-0000-0000-0000-0000000045c3', 'halal', null);
insert into public.sessions (id, group_id, host_user_id) values
  ('20000000-0000-0000-0000-0000000045c1', '10000000-0000-0000-0000-0000000045c1', '00000000-0000-0000-0000-0000000045c1');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000045c2","role":"authenticated"}', true);
set local role authenticated;
select public.join_session('20000000-0000-0000-0000-0000000045c1');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000045c3","role":"authenticated"}', true);
set local role authenticated;
select public.join_session('20000000-0000-0000-0000-0000000045c1');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000045c1","role":"authenticated"}', true);
set local role authenticated;
select public.join_session('20000000-0000-0000-0000-0000000045c1');
select public.add_candidate('20000000-0000-0000-0000-0000000045c1', (select id from public.foods where name = '토마토 파스타'));
select public.add_candidate('20000000-0000-0000-0000-0000000045c1', (select id from public.foods where name = '피자'));
select public.add_custom_candidate('20000000-0000-0000-0000-0000000045c1', 't갈비탕 정식');
reset role;

create temp view v45 as
  select f.name, c.vetoed, c.maybe_tags from public.candidates c join public.foods f on f.id = c.food_id
  where c.session_id = '20000000-0000-0000-0000-0000000045c1';
select is((select vetoed from v45 where name = '토마토 파스타'), false, '토마토 파스타: 유제품 못 먹는 사람이 있어도 빠지지 않는다');
select is((select maybe_tags from v45 where name = '토마토 파스타'), array['dairy'], '대신 "유제품 들어갈 수 있어요"');
select is((select vetoed from v45 where name = '피자'), true, '피자: 치즈(확실)라 유제품 못 먹는 사람이 있어요');
select is((select maybe_tags from v45 where name = '피자'), array['pork'], '피자 돼지고기는 할랄에게 약한 표시');
select is((select maybe_tags from v45 where name = 't갈비탕 정식'), array['pork'], '직접 적은 갈비탕: 할랄에게 돼지고기 약한 표시(소고기는 할랄과 상관없음)');

select * from finish();
rollback;
