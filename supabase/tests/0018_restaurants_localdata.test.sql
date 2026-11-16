-- 공공데이터 식당 (0017): 학교 앞 식당이 늘었고, 식사하는 곳만 들어갔다
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);
select ok((select count(*) from public.restaurants where source_id like 'localdata/%') >= 100, '공공데이터 식당이 100곳 넘게 들어갔다');
select is((select count(*)::int from public.restaurants where source_id like 'localdata/%' and cuisine is null), 0, '공공데이터 식당은 모두 종류가 있다');
select ok((select count(*) from public.restaurants where source_id like 'localdata/%' and '짜장면' = any (menus)) >= 5, '중국집은 짜장면을 대표 메뉴로 갖는다');
select * from finish();
rollback;
