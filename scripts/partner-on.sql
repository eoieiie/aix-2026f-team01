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

-- 4. 사진: scripts/shop-photos.md의 3단계를 따른다(shop-photos 버킷과 shop_photos 표, 0032)

-- 6. 직원 확인 비밀번호와 사장님 현황 주소 만들기 (4-27, 4-28, 0033)
--    staff_pin: 직원이 쿠폰을 확인할 때 넣는 숫자 4자리. 비워 두면(null) 확인 창 한 번으로 쓴다
--    owner_token: 사장님 현황 주소의 열쇠. 48자 무작위. 다시 돌리면 같은 값이 그대로 남는다(바꾸려면 7번)
insert into public.shop_private (restaurant_id, staff_pin, owner_token)
values (0, '1234', encode(extensions.gen_random_bytes(24), 'hex'))  -- ← 가게 id와 사장님이 정한 4자리
on conflict (restaurant_id) do update set staff_pin = excluded.staff_pin, updated_at = now();

--    사장님께 드릴 주소. 카톡으로 사장님 한 분께만 보낸다(주소를 아는 사람은 그 가게 숫자를 본다)
select 'https://babti.expo.app/owner/' || owner_token as 사장님_주소
from public.shop_private where restaurant_id = 0;

-- 7. 주소가 새어 나갔을 때: 토큰을 새로 만든다. 예전 주소는 바로 안 열린다
update public.shop_private
set owner_token = encode(extensions.gen_random_bytes(24), 'hex'), updated_at = now()
where restaurant_id = 0;

-- 5. 쿠폰을 몇 판에서 받았는지 (자세한 것은 scripts/coupon-stats.sql)
select r.name, count(distinct c.session_id) as 판, count(*) as 사람
from public.coupon_claims c join public.restaurants r on r.id = c.restaurant_id
group by r.name order by 판 desc;
