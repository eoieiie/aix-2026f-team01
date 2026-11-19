-- 제휴 카페 (0021): 방문 후보 카페가 들어갔고 제휴로 켜졌다
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);
select ok((select count(*) from public.restaurants where source_id like 'partner/%' and cuisine = 'cafe') = 9, '0020에 없던 방문 후보 카페 9곳');
select ok((select bool_and(partner) from public.restaurants where source_id like 'partner/%'), '방문 후보 카페는 제휴');
select is((select count(*)::int from public.restaurants where partner and cuisine <> 'cafe'), 0, '0021은 식당 제휴를 켜지 않는다');
select * from finish();
rollback;
