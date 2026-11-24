-- 0027 출시 필수 (명세 4-24, 2026-11-25): 계정 삭제, 금칙어, 신고, 차단, 모임 나가기·이름 바꾸기, 판 접기, 내 이름 바꾸기
-- 애플 심사 지침 5.1.1(v) 계정을 만들 수 있으면 앱 안에서 지울 수 있어야 한다, 1.2 사람이 쓴 글이 남에게 보이면
-- 거르기·신고·차단·연락처가 있어야 한다

-- 1. 금칙어 ----------------------------------------------------------------
-- 사람이 적어 남에게 보이는 글 네 가지(모임 이름, 이름, 한 줄 어필, 직접 적은 메뉴)에만 건다.
-- 띄어쓰기와 기호를 빼고 소문자로 맞춘 뒤 목록의 말이 들어 있으면 'blocked_word'로 거절한다.
-- 목록은 욕설, 비하, 혐오 표현만 짧게 둔다. 흔한 말과 겹치는 낱말(예: "새끼"만, "보지")은 넣지 않는다.
create or replace function public.blocked_words() returns text[]
language sql immutable set search_path = ''
as $$ select array[
  '시발','씨발','씨팔','시팔','씨바','쓰발','ㅅㅂ','ㅆㅂ','병신','븅신','빙신','ㅂㅅ','ㅄ','좆','ㅈ같',
  '개새끼','개새기','개색기','ㅅㄲ','미친놈','미친년','미친새','지랄','ㅈㄹ','닥쳐','꺼져','엿먹',
  '느금','니애미','니엄마','애미뒤','애비없','애미없','한남충','김치녀','된장녀','틀딱','급식충','맘충',
  '쪽바리','짱깨','깜둥','장애새','fuck','shit','bitch','asshole'
] $$;

create or replace function public.has_blocked_word(p_text text) returns boolean
language sql immutable set search_path = ''
as $$
  select p_text is not null and exists (
    select 1 from unnest(public.blocked_words()) as w
    where strpos(regexp_replace(lower(p_text), '[^가-힣ㄱ-ㅎㅏ-ㅣa-z0-9]', '', 'g'), w) > 0
  )
$$;

-- 검사할 칸 이름은 트리거 인자로 받는다(표마다 칸이 달라 new.칸을 바로 쓰면 다른 표에서 컴파일 오류가 난다)
create or replace function public.reject_blocked_words() returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_row jsonb := to_jsonb(new);
begin
  -- 음식은 직접 적은 것만 본다(기본 음식 목록은 팀이 넣는다)
  if tg_table_name = 'foods' and not coalesce((v_row ->> 'custom')::boolean, false) then
    return new;
  end if;
  if public.has_blocked_word(v_row ->> tg_argv[0]) then
    raise exception 'blocked_word';
  end if;
  return new;
end;
$$;

drop trigger if exists groups_blocked_words on public.groups;
create trigger groups_blocked_words before insert or update of name on public.groups
  for each row execute function public.reject_blocked_words('name');
drop trigger if exists memberships_blocked_words on public.memberships;
create trigger memberships_blocked_words before insert or update of display_name on public.memberships
  for each row execute function public.reject_blocked_words('display_name');
drop trigger if exists profiles_blocked_words on public.profiles;
create trigger profiles_blocked_words before insert or update of display_name on public.profiles
  for each row execute function public.reject_blocked_words('display_name');
drop trigger if exists candidates_blocked_words on public.candidates;
create trigger candidates_blocked_words before insert or update of pitch on public.candidates
  for each row execute function public.reject_blocked_words('pitch');
drop trigger if exists foods_blocked_words on public.foods;
create trigger foods_blocked_words before insert or update of name on public.foods
  for each row execute function public.reject_blocked_words('name');

-- 2. 신고 ------------------------------------------------------------------
-- 팀이 대시보드에서 보고 24시간 안에 처리한다(이용약관). 앱에서는 아무도 읽지 못한다(정책 없음).
-- 신고한 글은 그때 모습 그대로 content에 남긴다(지워져도 확인할 수 있게)
create table if not exists public.reports (
  id bigint generated always as identity primary key,
  reporter uuid references auth.users (id) on delete set null,
  target_user uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('pitch', 'custom_food', 'group_name', 'member_name')),
  reason text not null check (reason in ('abuse', 'sexual', 'spam', 'other')),
  group_id uuid references public.groups (id) on delete set null,
  session_id uuid references public.sessions (id) on delete set null,
  food_id bigint references public.foods (id) on delete set null,
  content text,
  status text not null default 'open' check (status in ('open', 'done')),
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;

create or replace function public.report_content(
  p_kind text, p_reason text, p_group_id uuid,
  p_session_id uuid default null, p_food_id bigint default null, p_user_id uuid default null
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_target uuid;
  v_content text;
begin
  if not exists (select 1 from public.memberships where group_id = p_group_id and user_id = v_uid) then
    raise exception 'not_member';
  end if;
  if p_kind in ('pitch', 'custom_food') then
    select c.proposed_by, case when p_kind = 'pitch' then c.pitch else f.name end
    into v_target, v_content
    from public.candidates c
    join public.sessions s on s.id = c.session_id
    join public.foods f on f.id = c.food_id
    where c.session_id = p_session_id and c.food_id = p_food_id and s.group_id = p_group_id;
  elsif p_kind = 'group_name' then
    select created_by, name into v_target, v_content from public.groups where id = p_group_id;
  elsif p_kind = 'member_name' then
    select user_id, display_name into v_target, v_content
    from public.memberships where group_id = p_group_id and user_id = p_user_id;
  else
    raise exception 'bad_report';
  end if;
  if v_content is null then
    raise exception 'report_target_not_found';
  end if;
  insert into public.reports (reporter, target_user, kind, reason, group_id, session_id, food_id, content)
  values (v_uid, v_target, p_kind, p_reason, p_group_id, p_session_id, p_food_id, left(v_content, 200));
end;
$$;

-- 3. 차단 ------------------------------------------------------------------
-- 차단한 사람의 한 줄 어필과 직접 적은 메뉴 이름은 내 화면에서 가린다(앱). 상대는 차단된 줄 모른다
create table if not exists public.blocks (
  blocker uuid not null references auth.users (id) on delete cascade,
  blocked uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);
alter table public.blocks enable row level security;
drop policy if exists blocks_select_own on public.blocks;
create policy blocks_select_own on public.blocks for select to authenticated using (blocker = auth.uid());

create or replace function public.block_user(p_user_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
begin
  if p_user_id = v_uid then
    raise exception 'cannot_block_self';
  end if;
  if not exists (
    select 1 from public.memberships a join public.memberships b on a.group_id = b.group_id
    where a.user_id = v_uid and b.user_id = p_user_id
  ) then
    raise exception 'not_member';
  end if;
  insert into public.blocks (blocker, blocked) values (v_uid, p_user_id) on conflict do nothing;
end;
$$;

create or replace function public.unblock_user(p_user_id uuid) returns void
language sql security definer set search_path = ''
as $$ delete from public.blocks where blocker = public.require_uid() and blocked = p_user_id $$;

-- 차단한 사람 목록. 이름은 같이 있던 모임에서 쓰던 이름(없으면 null)
create or replace function public.my_blocks()
returns table (user_id uuid, display_name text, created_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select b.blocked, (
    select m.display_name from public.memberships m
    where m.user_id = b.blocked order by m.joined_at desc limit 1
  ), b.created_at
  from public.blocks b
  where b.blocker = auth.uid()
  order by b.created_at desc
$$;

-- 4. 방장 넘기기 ------------------------------------------------------------
-- 방장(모임을 만든 사람)이 나가거나 계정을 지우면 남은 사람 중 가장 먼저 들어온 사람이 방장이 된다.
-- 그 사람이 연 진행 중인 판의 판장도 같은 규칙으로 넘긴다. 남은 사람이 없으면 모임을 지운다
create or replace function public.hand_over(p_group_id uuid, p_uid uuid) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_next uuid;
begin
  select m.user_id into v_next from public.memberships m
  where m.group_id = p_group_id and m.user_id <> p_uid
  order by m.joined_at, m.user_id limit 1;
  if v_next is null then
    delete from public.groups where id = p_group_id;
    return false;
  end if;
  update public.groups set created_by = v_next where id = p_group_id and created_by = p_uid;
  update public.sessions set host_user_id = v_next where group_id = p_group_id and host_user_id = p_uid;
  return true;
end;
$$;
revoke execute on function public.hand_over(uuid, uuid) from public, anon, authenticated;

-- 5. 모임 나가기 ------------------------------------------------------------
-- 진행 중인 판에서 내 참여, 표, 내가 올린 후보를 뺀다. 끝난 판의 식사 기록은 모임 것이라 남긴다(같이 먹은 사람에서도 남는다)
create or replace function public.leave_group(p_group_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_open uuid[];
  v_s uuid;
begin
  if not exists (select 1 from public.memberships where group_id = p_group_id and user_id = v_uid) then
    raise exception 'not_member';
  end if;
  select coalesce(array_agg(id), '{}') into v_open from public.sessions where group_id = p_group_id and status <> 'done';
  if not public.hand_over(p_group_id, v_uid) then
    return; -- 혼자였다. 모임이 지워졌다
  end if;
  delete from public.votes where user_id = v_uid and session_id = any (v_open);
  delete from public.candidates where proposed_by = v_uid and session_id = any (v_open);
  delete from public.session_participants where user_id = v_uid and session_id = any (v_open);
  delete from public.memberships where group_id = p_group_id and user_id = v_uid;
  foreach v_s in array v_open loop
    perform public.refresh_vetoes(v_s);
  end loop;
end;
$$;

-- 6. 모임 이름 바꾸기 (방장만) ----------------------------------------------
create or replace function public.rename_group(p_group_id uuid, p_name text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
begin
  if not exists (select 1 from public.groups where id = p_group_id and created_by = v_uid) then
    raise exception 'not_owner';
  end if;
  update public.groups set name = public.clean_name(p_name, public.app_limit('GROUP_NAME_MAX'))
  where id = p_group_id;
end;
$$;

-- 7. 판 접기 (판을 연 사람만, 끝나지 않은 판만). 판을 지워서 기록이 남지 않는다 -------------
create or replace function public.cancel_session(p_session_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_session public.sessions;
begin
  select * into v_session from public.sessions where id = p_session_id for update;
  if v_session.id is null or not public.is_group_member(v_session.group_id) then
    raise exception 'session_not_found';
  end if;
  if v_session.host_user_id <> v_uid then
    raise exception 'not_host';
  end if;
  if v_session.status = 'done' then
    raise exception 'already_done';
  end if;
  delete from public.sessions where id = p_session_id;
end;
$$;

-- 8. 내 이름 바꾸기. 프로필과 모든 모임의 이름을 같이 바꾼다 ------------------------
create or replace function public.set_my_name(p_name text) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_name text := public.clean_name(p_name, public.app_limit('DISPLAY_NAME_MAX'));
begin
  insert into public.profiles (user_id, display_name) values (v_uid, v_name)
  on conflict (user_id) do update set display_name = excluded.display_name;
  begin
    update public.memberships set display_name = v_name where user_id = v_uid;
  exception when unique_violation then
    raise exception 'name_taken';
  end;
  return v_name;
end;
$$;

-- 9. 계정 삭제 --------------------------------------------------------------
-- 방장인 모임은 넘기고(4번), 진행 중인 판에서 빠진 뒤 auth.users를 지운다. 나머지(프로필, 못 먹는 것, 소속,
-- 표, 올린 후보, 차단, 쿠폰 받은 기록, 같이 먹은 사람 줄)는 외래키로 같이 지워진다. 식사 기록 자체는 모임에 남는다
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_g uuid;
  v_open uuid[];
  v_s uuid;
begin
  select coalesce(array_agg(s.id), '{}') into v_open
  from public.sessions s join public.session_participants p on p.session_id = s.id
  where p.user_id = v_uid and s.status <> 'done';
  for v_g in select group_id from public.memberships where user_id = v_uid loop
    perform public.hand_over(v_g, v_uid);
  end loop;
  -- 소속이 없는 모임에서 만든 것(남은 판장)이 있으면 그 판은 지운다
  delete from public.sessions where host_user_id = v_uid;
  delete from public.groups where created_by = v_uid;
  delete from auth.users where id = v_uid;
  foreach v_s in array v_open loop
    if exists (select 1 from public.sessions where id = v_s) then
      perform public.refresh_vetoes(v_s);
    end if;
  end loop;
end;
$$;

revoke execute on function
  public.report_content(text, text, uuid, uuid, bigint, uuid), public.block_user(uuid), public.unblock_user(uuid),
  public.my_blocks(), public.leave_group(uuid), public.rename_group(uuid, text), public.cancel_session(uuid),
  public.set_my_name(text), public.delete_my_account()
  from public, anon;
grant execute on function
  public.report_content(text, text, uuid, uuid, bigint, uuid), public.block_user(uuid), public.unblock_user(uuid),
  public.my_blocks(), public.leave_group(uuid), public.rename_group(uuid, text), public.cancel_session(uuid),
  public.set_my_name(text), public.delete_my_account()
  to authenticated;
