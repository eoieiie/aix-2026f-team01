-- 명세 5절 실시간 구독. 변경이 오면 앱이 그 판을 통째로 다시 읽는다.
-- 구독도 RLS를 따르므로 votes는 본인 것만 온다.
alter publication supabase_realtime
  add table public.sessions, public.session_participants, public.candidates, public.votes;
