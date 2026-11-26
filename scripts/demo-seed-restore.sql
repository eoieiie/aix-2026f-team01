-- 시연 자료를 한 번에 되돌리기 (명세 4-32). 12/9 시상 뒤 팀만 Supabase 대시보드 SQL Editor에서 쓴다.
-- 1. 시연 모임을 지운다(판, 후보, 표, 식사 기록, 구성원, 초대 링크로 들어온 사람, 그 판의 쿠폰이 같이 지워진다)
-- 2. 시연용 친구 계정 다섯을 지운다
-- 3. 숨긴 예전 모임의 구성원 줄을 돌려놓는다(그동안 같은 이름이 생겨 못 돌린 줄은 맨 아래 조회에 남는다)
-- 4. demo_seed에서 넣은 행과 대상 표시를 지운다. 가상 인물 원본, 원래 모임, 예시 가게 990001의 표시(mark)는 남긴다
begin;

delete from public.groups g using public.demo_seed d
where d.kind = 'seed' and d.table_name = 'groups' and d.row_id = g.id::text;
delete from auth.users u using public.demo_seed d
where d.kind = 'seed' and d.table_name = 'profiles' and d.row_id = u.id::text;

insert into public.memberships (group_id, user_id, display_name, joined_at)
select h.group_id, h.user_id, h.display_name, coalesce(h.joined_at, h.hidden_at) from public.demo_hidden_memberships h
where h.was_member
on conflict do nothing;
delete from public.demo_hidden_memberships h where not h.was_member;
delete from public.demo_hidden_memberships h
using public.memberships m where m.group_id = h.group_id and m.user_id = h.user_id;

delete from public.demo_seed where kind = 'seed' or table_name = 'targets';

-- 확인: 못 돌린 구성원 줄(0이어야 한다)과 남은 표시
select count(*) as 못_돌린_줄 from public.demo_hidden_memberships;
select table_name, kind, count(*) from public.demo_seed group by 1, 2 order by 1, 2;
commit;
