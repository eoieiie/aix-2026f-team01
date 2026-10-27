-- 명세 5절 권한. 읽기는 RLS로 막고, 쓰기는 profiles 말고는 아예 열지 않는다.
-- 상태를 바꾸는 일은 0003의 서버 함수(security definer)만 한다.

alter table public.profiles enable row level security;
alter table public.foods enable row level security;
alter table public.restrictions enable row level security;
alter table public.groups enable row level security;
alter table public.memberships enable row level security;
alter table public.sessions enable row level security;
alter table public.session_participants enable row level security;
alter table public.candidates enable row level security;
alter table public.votes enable row level security;
alter table public.meals enable row level security;
alter table public.meal_participants enable row level security;

-- 로컬은 기본으로 모든 권한이 열려 있어서 먼저 다 거두고 필요한 것만 준다
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

grant select on
  public.profiles, public.foods, public.restrictions, public.groups, public.memberships,
  public.sessions, public.session_participants, public.candidates, public.votes,
  public.meals, public.meal_participants
  to authenticated;

-- profiles는 본인만 쓴다 (5절)
grant insert (user_id, display_name, handle, quiz_answers, axes) on public.profiles to authenticated;
grant update (display_name, handle, quiz_answers, axes) on public.profiles to authenticated;

-- 정책 안에서 쓰는 소속 확인. RLS를 거치지 않아야 정책이 자기 자신을 다시 부르지 않는다
create function public.is_group_member(p_group_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.group_id = p_group_id and m.user_id = auth.uid()
  )
$$;

create function public.is_session_member(p_session_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.sessions s
    join public.memberships m on m.group_id = s.group_id
    where s.id = p_session_id and m.user_id = auth.uid()
  )
$$;

grant execute on function public.is_group_member(uuid), public.is_session_member(uuid) to authenticated;

create policy profiles_select on public.profiles
  for select to authenticated using (true);
create policy profiles_insert on public.profiles
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy profiles_update on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy foods_select on public.foods
  for select to authenticated using (true);

create policy restrictions_select on public.restrictions
  for select to authenticated using (user_id = (select auth.uid()));

create policy groups_select on public.groups
  for select to authenticated using (public.is_group_member(id));

create policy memberships_select on public.memberships
  for select to authenticated using (public.is_group_member(group_id));

create policy sessions_select on public.sessions
  for select to authenticated using (public.is_group_member(group_id));

create policy session_participants_select on public.session_participants
  for select to authenticated using (public.is_session_member(session_id));

create policy candidates_select on public.candidates
  for select to authenticated using (public.is_session_member(session_id));

-- 표는 본인 것만 (4-11)
create policy votes_select on public.votes
  for select to authenticated using (user_id = (select auth.uid()));

create policy meals_select on public.meals
  for select to authenticated using (public.is_group_member(group_id));

create policy meal_participants_select on public.meal_participants
  for select to authenticated using (
    exists (
      select 1 from public.meals ml
      where ml.id = meal_id and public.is_group_member(ml.group_id)
    )
  );
