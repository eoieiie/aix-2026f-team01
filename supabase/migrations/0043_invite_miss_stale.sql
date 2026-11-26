-- 0042 후속: 지워진 계정의 로그인 토큰이 아직 살아 있는 브라우저에서 초대 주소를 열면
-- 틀린 기록(invite_misses)의 외래 키에 걸려 "연결할 수 없어요"가 떴다(실제 주소에서 확인).
-- 계정이 있을 때만 기록한다. 계정이 없으면 기록 없이 빈 결과("모임을 찾을 수 없어요")로 간다. 여러 번 돌려도 같다
create or replace function public.invite_miss(p_uid uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.invite_misses where at < now() - interval '1 day';
  insert into public.invite_misses (user_id)
  select p_uid where exists (select 1 from auth.users u where u.id = p_uid);
end;
$$;
revoke execute on function public.invite_miss(uuid) from public, anon, authenticated;

notify pgrst, 'reload schema';
