-- 쿠폰 현황판(/admin/coupons, 명세 4-28)을 볼 운영자 넣기와 빼기. 팀만 Supabase 대시보드 SQL Editor에서 쓴다.
-- 운영자 화면에는 쿠폰을 받은 사람 이름이 보인다. 팀원 계정만 넣는다.

-- 1. 아이디로 계정 찾기 (앱 프로필 > 아이디)
select p.user_id, p.display_name, p.handle
from public.profiles p
where p.handle = 'my_handle';  -- ← 넣을 사람 아이디

-- 2. 넣기. 여러 번 돌려도 하나만 남는다
insert into public.app_admins (user_id, note)
select p.user_id, '팀 운영자 ' || to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM-DD')
from public.profiles p
where p.handle = 'my_handle'
on conflict (user_id) do nothing;

-- 3. 지금 운영자 목록
select a.user_id, p.display_name, p.handle, a.note, a.created_at
from public.app_admins a left join public.profiles p on p.user_id = a.user_id
order by a.created_at;

-- 4. 빼기
delete from public.app_admins a
using public.profiles p
where p.user_id = a.user_id and p.handle = 'my_handle';
