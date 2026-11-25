-- 파닭은 치킨 그림 (0052)
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);
-- 그림 경로가 없는 로컬 DB에서도 그림 함수가 음식을 고를 수 있게(되돌림)
update public.foods set image_path = coalesce(image_path, id || '.webp') where name = '치킨' and not custom;
select is(public.shop_food_word('미쳐버린파닭'), '치킨', '파닭은 치킨');
select is((select name from public.foods where id = public.shop_thumb_food('미쳐버린파닭', '{}', 'western')), '치킨', '그래서 가게 그림도 치킨');
select is(public.shop_food_word('통닭집'), '치킨', '통닭은 그대로');
select * from finish();
rollback;
