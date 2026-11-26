-- 이름으로 분명한 가게 종류 (명세 4-26, 0041). 실제 서버에서도 돌려 고친 뒤 남은 것이 없는지 본다
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

select is((select count(*)::int from public.restaurants
  where area <> 'zz_test' and cuisine is distinct from 'korean'
    and name ~ '(감자탕|국밥|찌개|칼국수|냉면|순대|보쌈|족발|백반|한정식)'
    and name not like '%기룽쟝족발덮밥%'),
  0, '한식 낱말이 이름에 있으면 한식');
select is((select count(*)::int from public.restaurants
  where area <> 'zz_test' and cuisine is distinct from 'chinese'
    and name ~ '(짬뽕|짜장|마라|탕수육)'),
  0, '중식 낱말이 이름에 있으면 중식');
select is((select count(*)::int from public.restaurants
  where area <> 'zz_test' and name ~ '파스타' and cuisine is distinct from 'western'),
  0, '파스타집은 양식');

select * from finish();
rollback;
