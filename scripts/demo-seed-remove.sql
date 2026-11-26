-- 팀장 계정에 넣은 시연 자료 한 번에 지우기 (명세 4-32). 팀만 Supabase 대시보드 SQL Editor에서 쓴다.
-- public.demo_seed의 kind 'seed' 행만 지운다. 'mark'(가상 인물 민준, 서연, 지호와 원래 모임, 예시 가게 990001)는 지우지 않는다.
-- 새 모임을 지우면 그 판, 후보, 표, 식사 기록, 구성원(초대 링크로 들어온 사람 포함), 그 판에서 받은 쿠폰이 같이 지워진다.
-- 팀장의 원래 모임과 기록(Aix, Test, 이음이 등)은 건드리지 않는다.
begin;

delete from public.meals m using public.demo_seed d
where d.kind = 'seed' and d.table_name = 'meals' and d.row_id = m.id::text;
delete from public.sessions s using public.demo_seed d
where d.kind = 'seed' and d.table_name = 'sessions' and d.row_id = s.id::text;
delete from public.memberships m using public.demo_seed d
where d.kind = 'seed' and d.table_name = 'memberships' and d.row_id = m.group_id || '/' || m.user_id;
delete from public.groups g using public.demo_seed d
where d.kind = 'seed' and d.table_name = 'groups' and d.row_id = g.id::text;
delete from public.demo_seed where kind = 'seed';

-- 남은 표시 확인(가상 인물, 원래 모임, 예시 가게만 남아야 한다)
select table_name, kind, count(*) from public.demo_seed group by 1, 2 order by 1, 2;
commit;

-- 표시까지 모두 없애려면(예시 가게가 다시 아무에게도 안 보이고, 가상 인물의 쿠폰이 숫자에 다시 섞인다)
-- delete from public.demo_seed;
