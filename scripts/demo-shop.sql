-- 발표 캡처용 예시 제휴 가게 "한양 분식 (예시)"와 예시 쿠폰 기록 (명세 4-26~4-28). 팀만 SQL Editor에서 쓴다.
-- 동네가 'zz_test'라서 실제 모임(erica)의 가게 탭과 판 결과에는 나오지 않는다. 운영자 현황판도 기본으로는 뺀다.
-- 보는 곳: 가게 상세 /shops/990001, 운영자 /admin/coupons?area=zz_test, 사장님 주소는 맨 아래 select.
-- 사람과 판은 모두 지어낸 예시다(이름 "예시 손님"). 실제 기록과 섞이지 않게 id를 고정했고, 여러 번 돌려도 같다.
-- 지우기: 맨 아래 주석의 delete 네 줄.

insert into public.restaurants (id, area, name, cuisine, menus, lat, lng, address, partner, coupon_text, source_id)
overriding system value
values (990001, 'zz_test', '한양 분식 (예시)', 'korean', array['떡볶이', '김밥', '라면'], 37.2992, 126.8378,
  '예시 가게라 주소가 없어요', true, '밥BTI 쿠폰 보여 주면 튀김 한 접시', 'demo/hanyang-bunsik')
on conflict (id) do update set area = excluded.area, name = excluded.name, cuisine = excluded.cuisine,
  menus = excluded.menus, lat = excluded.lat, lng = excluded.lng, address = excluded.address,
  partner = excluded.partner, coupon_text = excluded.coupon_text, source_id = excluded.source_id;

-- 직원 확인 비밀번호 2580, 사장님 주소 토큰(처음 한 번만 만들고 그 뒤로는 그대로 둔다)
insert into public.shop_private (restaurant_id, staff_pin, owner_token)
values (990001, '2580', encode(extensions.gen_random_bytes(24), 'hex'))
on conflict (restaurant_id) do update set staff_pin = excluded.staff_pin;

-- 예시 손님 6명(익명 계정)
insert into auth.users (instance_id, id, aud, role, is_anonymous, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', ('00000000-0000-4000-8000-99000000000' || n)::uuid,
  'authenticated', 'authenticated', true, '{}'::jsonb, '{}'::jsonb, now(), now()
from generate_series(1, 6) n
on conflict (id) do nothing;
insert into public.profiles (user_id, display_name)
select ('00000000-0000-4000-8000-99000000000' || n)::uuid, '예시 손님 ' || n
from generate_series(1, 6) n
on conflict (user_id) do nothing;

-- 예시 모임 하나와 끝난 판 6개(한 판이 한 팀)
insert into public.groups (id, name, invite_code, created_by, area)
values ('00000000-0000-4000-8000-990000000100', '예시 모임', 'ZZDEMX', '00000000-0000-4000-8000-990000000001', 'zz_test')
on conflict (id) do nothing;
insert into public.memberships (group_id, user_id, display_name)
select '00000000-0000-4000-8000-990000000100', ('00000000-0000-4000-8000-99000000000' || n)::uuid, '예시 손님 ' || n
from generate_series(1, 6) n
on conflict do nothing;

with plan (n, food, people, days_ago, hour, used) as (values
  (1, 16, 4, 9, 12, true), (2, 17, 2, 7, 18, true), (3, 16, 3, 5, 12, true),
  (4, 20, 5, 3, 13, true), (5, 16, 2, 1, 19, true), (6, 17, 3, 0, 12, false)
),
s as (
  insert into public.sessions (id, group_id, host_user_id, status, decided_food_id, decided_at, created_at)
  select ('00000000-0000-4000-8000-99000000020' || n)::uuid, '00000000-0000-4000-8000-990000000100',
    '00000000-0000-4000-8000-990000000001', 'done', food,
    date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul' - make_interval(days => days_ago) + make_interval(hours => hour),
    date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul' - make_interval(days => days_ago) + make_interval(hours => hour) - interval '10 minutes'
  from plan
  on conflict (id) do nothing
  returning id
)
select count(*) from s;

insert into public.session_participants (session_id, user_id, voted)
select ('00000000-0000-4000-8000-99000000020' || p.n)::uuid, ('00000000-0000-4000-8000-99000000000' || u)::uuid, true
from (values (1, 4), (2, 2), (3, 3), (4, 5), (5, 2), (6, 3)) as p (n, people)
cross join lateral generate_series(1, p.people) u
on conflict do nothing;

-- 쿠폰: 판마다 방장 한 명이 받는다. 5팀은 가게에서 썼고 마지막 판은 아직 안 썼다. 가게 화면에서 받은 쿠폰 1장(손님 6)
insert into public.coupon_claims (restaurant_id, session_id, user_id, code, claimed_at, redeemed_at, source, claim_day, benefit, party_size)
select 990001, s.id, s.host_user_id, public.coupon_code(s.id, 990001), s.decided_at + interval '1 minute',
  case when s.id <> '00000000-0000-4000-8000-990000000206' then s.decided_at + interval '25 minutes' end,
  'session', (s.decided_at at time zone 'Asia/Seoul')::date, '밥BTI 쿠폰 보여 주면 튀김 한 접시',
  (select count(*) from public.session_participants sp where sp.session_id = s.id)
from public.sessions s
where s.group_id = '00000000-0000-4000-8000-990000000100'
on conflict (session_id, restaurant_id, user_id) do nothing;

insert into public.coupon_claims (restaurant_id, session_id, user_id, code, claimed_at, redeemed_at, source, claim_day, benefit, party_size)
select 990001, null, '00000000-0000-4000-8000-990000000006', 'ZZDEMO',
  now() - interval '2 days' - interval '3 hours', now() - interval '2 days' - interval '2 hours 40 minutes',
  'shop', ((now() - interval '2 days' - interval '3 hours') at time zone 'Asia/Seoul')::date, '밥BTI 쿠폰 보여 주면 튀김 한 접시', 1
where not exists (select 1 from public.coupon_claims c where c.restaurant_id = 990001 and c.source = 'shop');

-- 사장님 주소
select 'https://babti.expo.app/owner/' || owner_token as 사장님_주소 from public.shop_private where restaurant_id = 990001;

-- 지우기(예시를 다 쓴 뒤):
-- delete from public.coupon_claims where restaurant_id = 990001;
-- delete from public.groups where id = '00000000-0000-4000-8000-990000000100';
-- delete from auth.users where id::text like '00000000-0000-4000-8000-99000000000_';
-- delete from public.restaurants where id = 990001;
