-- 0031 판이 닫혔는지 알기, 신고 처리 표시 (2026-11-25, 명세 4-24)
-- 1) 판을 연 사람이 판을 접으면(cancel_session, 판을 지움) 다른 사람 화면은 판을 못 읽는다. 권한 때문에 안 보이는 것(멤버 아님)과
--    판이 없어진 것을 앱이 구분하도록, 판이 있는지만 돌려준다. 판 내용은 돌려주지 않는다
create or replace function public.session_exists(p_session_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.sessions s where s.id = p_session_id) $$;

revoke execute on function public.session_exists(uuid) from public, anon;
grant execute on function public.session_exists(uuid) to authenticated;

-- 2) 신고를 팀이 처리했는지 표시한다. 앱에서는 읽지도 쓰지도 않는다(관리 SQL로만, scripts/reports.sql)
alter table public.reports add column if not exists handled_at timestamptz;
alter table public.reports add column if not exists handled_note text;
