# 가게 사진 올리기 (명세 4-26, 0032)

사장님이 주거나, 사장님께 말씀드리고 팀이 찍은 사진만 올린다. 네이버, 카카오 지도의 사진은 쓰지 않는다.
사진이 0장이어도 가게 화면은 대표 메뉴의 음식 그림으로 채워진다.

1. 파일 이름 정하기: 가게 id(scripts/partner-on.sql 1번으로 찾는다)와 순서로 `<가게 id>/<순서>.jpg` (예: `341/1.jpg`). 영어 소문자, 숫자, `/ _ -`만. 한 장 5MB까지, jpg, png, webp. 휴대폰 사진은 긴 쪽 1600px 정도로 줄여서 올린다.
2. 올리기: Supabase 대시보드 > Storage > `shop-photos` 버킷 > 가게 id 폴더를 만들고 파일을 끌어 놓는다.
3. 가게에 붙이기: SQL Editor에서 아래를 돌린다. `sort`가 가장 작은 사진이 목록과 상세 맨 위에 보인다.

```sql
insert into public.shop_photos (restaurant_id, path, sort, credit)
values (341, '341/1.jpg', 0, '사장님 제공'),      -- ← 가게 id, 파일 이름, 순서, '사장님 제공' 또는 '밥BTI 팀 촬영'
       (341, '341/2.jpg', 1, '밥BTI 팀 촬영')
on conflict (restaurant_id, path) do update set sort = excluded.sort, credit = excluded.credit;
```

빼기: `delete from public.shop_photos where restaurant_id = 341 and path = '341/2.jpg';` 뒤 Storage에서 파일도 지운다.
