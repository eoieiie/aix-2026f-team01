-- 사장님 동의를 받은 가게를 제휴로 켜는 SQL (명세 4-21, 4-23). 앱 안 관리자 화면은 만들지 않는다.
-- 쓰는 곳: Supabase 대시보드 SQL Editor. 팀만 쓴다. 바꾼 뒤 #53에 "OO 제휴 켬(날짜, 동의 받은 사람)"을 한 줄 남긴다.
-- 지킬 것: 동의서(가게 이름, 앱과 발표 자료에 써도 되는 범위, 혜택, 기간)를 받은 가게만. 대가가 오가면 앱에 "광고"가 붙는다(자동).

-- 1. 가게 찾기: 이름 일부로 찾고 id와 source_id를 확인한다
select id, name, cuisine, partner, coupon_text, source_id
from public.restaurants
where name like '%신디도넛%';

-- 2. 켜기: 찾은 id 하나만 바꾼다. coupon_text는 사장님이 정한 혜택 한 줄 그대로
update public.restaurants
set partner = true,
    coupon_text = '밥BTI 쿠폰 보여 주면 음료 500원 할인'
where id = 0;  -- ← 1에서 찾은 id

-- 3. 끄기: 기간이 끝나거나 사장님이 그만두면
update public.restaurants
set partner = false, coupon_text = null
where id = 0;  -- ← 끌 가게 id

-- 4. 사진: 식당 사진 버킷(PR #78, 0016)이 생기면 restaurant-photos 버킷에 올리고 그 공개 주소를 photo_url에 넣는다
-- update public.restaurants set photo_url = '<버킷 공개 주소>' where id = 0;

-- 5. 쿠폰을 몇 판에서 받았는지 (사장님께 보여 줄 숫자)
select r.name, count(distinct c.session_id) as 판, count(*) as 사람
from public.coupon_claims c join public.restaurants r on r.id = c.restaurant_id
group by r.name order by 판 desc;
