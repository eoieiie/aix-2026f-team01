-- 신고 확인 (명세 4-24). 관리자 화면은 없다. Supabase 대시보드 SQL Editor에서 매일 한 번 돌린다.
-- 약관에 "신고는 24시간 안에 확인"이라고 적었다. 담당은 13주차 회의에서 정한다(docs/ops.md)

-- 1) 아직 처리 안 한 신고 (오래된 것부터)
select r.id, r.created_at at time zone 'Asia/Seoul' as 신고시각, r.kind, r.reason, r.content,
       g.name as 모임, r.target_user, r.reporter
from public.reports r
left join public.groups g on g.id = r.group_id
where r.status = 'open'
order by r.created_at;

-- 2) 처리했다고 표시 (id와 메모를 바꿔서)
-- update public.reports set status = 'done', handled_at = now(), handled_note = '확인함, 조치 없음' where id = 0;

-- 3) 조치가 필요하면: 어필 지우기, 모임 이름 바꾸기 등은 해당 표를 직접 고친다. 무엇을 했는지 handled_note에 적는다

-- 4) 최근 7일 처리 현황
select status, count(*) from public.reports where created_at > now() - interval '7 days' group by status;
