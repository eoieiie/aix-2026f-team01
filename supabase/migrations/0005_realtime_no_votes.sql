-- 표(votes)를 실시간 구독에서 뺀다 (4-11 익명 투표).
-- Realtime은 지운 줄(DELETE) 신호에는 RLS를 적용하지 못해 기본 키를 그대로 보낸다.
-- votes의 기본 키는 (session_id, user_id, food_id)라서, 표를 취소하면 누가 무엇을 취소했는지가
-- 그 판을 구독한 다른 사람에게 갈 수 있다. "투표했는지"는 session_participants.voted가
-- 바뀌면서 이미 신호가 오므로 votes 구독은 필요 없다.
alter publication supabase_realtime drop table public.votes;
