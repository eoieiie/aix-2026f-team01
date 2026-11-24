-- 메뉴 그림 (0025): 기본 음식에만, 버킷 안 파일 이름 모양만. (0026의 실제 경로 채우기는 seed 순서와 상관없게 여기서 보지 않는다)
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);
select lives_ok($$ update public.foods set image_path = id || '.webp' where id = (select min(id) from public.foods where not custom) $$, '기본 음식에는 "숫자.webp" 경로를 넣을 수 있다');
select throws_ok($$ update public.foods set image_path = 'https://evil.example/x.webp' where id = (select min(id) from public.foods where not custom) $$, '23514', null, '버킷 안 파일 이름 모양이 아니면 거절');
select is((select count(*)::int from public.foods where custom and image_path is not null), 0, '직접 적은 음식에는 그림 경로가 없다');
select * from finish();
rollback;
