-- 명세 5절 서버 함수(1단계). 규칙은 여기에만 있다 (3절 1번).
-- 오류는 영어 코드로 던진다. 앱이 4절의 한국어 문구로 바꿔 보여준다.

-- 공통 ------------------------------------------------------------------

create function public.require_uid() returns uuid
language plpgsql stable set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_signed_in';
  end if;
  return v_uid;
end;
$$;

-- 한 사람의 제한 하나가 음식 하나를 막는지 (4-9 거부권 판정 규칙)
create function public.restriction_blocks(
  p_food_id bigint, p_food_tags text[], p_tag text, p_restricted_food_id bigint
) returns boolean
language sql immutable set search_path = ''
as $$
  select case
    when p_restricted_food_id is not null then p_restricted_food_id = p_food_id
    when p_tag = 'halal' then not ('halal_ok' = any (p_food_tags))
    when p_tag = 'vegetarian' then not ('veg_ok' = any (p_food_tags))
    when p_tag = 'vegan' then not ('vegan_ok' = any (p_food_tags))
    else p_tag = any (p_food_tags)
  end
$$;

-- 그 판의 참여자 기준으로 후보 전체를 다시 판정한다.
-- 새로 빠진 후보에 찍힌 표는 지운다. 빠진 후보는 누를 수 없어서 남겨 두면 그 표를 되돌릴 수 없다.
create function public.refresh_vetoes(p_session_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.candidates c
  set vetoed = exists (
    select 1
    from public.session_participants sp
    join public.restrictions r on r.user_id = sp.user_id
    join public.foods f on f.id = c.food_id
    where sp.session_id = c.session_id
      and public.restriction_blocks(f.id, f.tags, r.tag, r.food_id)
  )
  where c.session_id = p_session_id;

  delete from public.votes v
  using public.candidates c
  where c.session_id = p_session_id
    and v.session_id = c.session_id and v.food_id = c.food_id
    and c.vetoed;

  update public.session_participants sp
  set voted = exists (
    select 1 from public.votes v
    where v.session_id = sp.session_id and v.user_id = sp.user_id
  )
  where sp.session_id = p_session_id;
end;
$$;

-- 이름이 비었거나 길이를 넘으면 오류. 앞뒤 공백은 지운다
create function public.clean_name(p_name text, p_max int) returns text
language plpgsql immutable set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
begin
  if char_length(v_name) = 0 then
    raise exception 'name_empty';
  end if;
  if char_length(v_name) > p_max then
    raise exception 'name_too_long';
  end if;
  return v_name;
end;
$$;

-- 이름을 주지 않으면 프로필 이름을 쓴다. 프로필이 없으면 이름만 담아 만든다 (4-2, 4-5)
create function public.resolve_display_name(p_uid uuid, p_display_name text) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_name text;
begin
  if p_display_name is null then
    select display_name into v_name from public.profiles where user_id = p_uid;
    if v_name is null then
      raise exception 'display_name_required';
    end if;
    return v_name;
  end if;

  v_name := public.clean_name(p_display_name, 20);
  insert into public.profiles (user_id, display_name)
  values (p_uid, v_name)
  on conflict (user_id) do nothing;
  return v_name;
end;
$$;

-- 판을 잠그고 상태를 돌려준다. 소속이 아니면 오류
create function public.lock_session(p_session_id uuid, p_uid uuid) returns public.sessions
language plpgsql security definer set search_path = ''
as $$
declare
  v_session public.sessions;
begin
  select * into v_session from public.sessions where id = p_session_id for update;
  if not found then
    raise exception 'session_not_found';
  end if;
  if not exists (
    select 1 from public.memberships
    where group_id = v_session.group_id and user_id = p_uid
  ) then
    raise exception 'not_member';
  end if;
  return v_session;
end;
$$;

create function public.require_participant(p_session_id uuid, p_uid uuid) returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.session_participants
    where session_id = p_session_id and user_id = p_uid
  ) then
    raise exception 'not_participant';
  end if;
end;
$$;

-- 가중치 추첨. p_r은 0 이상 1 미만. 테스트에서 p_r을 고정해 확인할 수 있게 나눴다
create function public.pick_weighted(p_food_ids bigint[], p_weights int[], p_r double precision)
returns bigint
language plpgsql immutable set search_path = ''
as $$
declare
  v_total bigint := 0;
  v_target double precision;
  v_acc bigint := 0;
  i int;
begin
  for i in 1 .. coalesce(array_length(p_food_ids, 1), 0) loop
    v_total := v_total + p_weights[i];
  end loop;
  if v_total <= 0 then
    return null;
  end if;
  v_target := p_r * v_total;
  for i in 1 .. array_length(p_food_ids, 1) loop
    v_acc := v_acc + p_weights[i];
    if v_target < v_acc then
      return p_food_ids[i];
    end if;
  end loop;
  return p_food_ids[array_length(p_food_ids, 1)];
end;
$$;

-- 모임 (4-2 ~ 4-5) ---------------------------------------------------------

create function public.create_group(p_name text, p_display_name text default null)
returns table (group_id uuid, invite_code text)
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_name text := public.clean_name(p_name, 40);
  v_display_name text := public.resolve_display_name(v_uid, p_display_name);
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  v_group_id uuid;
begin
  loop
    select string_agg(substr(v_alphabet, 1 + floor(random() * 32)::int, 1), '')
      into v_code
      from generate_series(1, 6);
    begin
      insert into public.groups (name, invite_code, created_by)
      values (v_name, v_code, v_uid)
      returning id into v_group_id;
      exit;
    exception when unique_violation then
      -- 코드가 겹치면 다시 뽑는다
    end;
  end loop;

  insert into public.memberships (group_id, user_id, display_name)
  values (v_group_id, v_uid, v_display_name);

  return query select v_group_id, v_code;
end;
$$;

-- 초대 링크를 연 사람(아직 소속이 아닐 수 있음)에게 모임 이름을 보여준다 (4-5)
create function public.get_group_by_code(p_code text)
returns table (group_id uuid, name text, is_member boolean)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
begin
  return query
    select g.id, g.name, exists (
      select 1 from public.memberships m where m.group_id = g.id and m.user_id = v_uid
    )
    from public.groups g
    where g.invite_code = upper(btrim(p_code));
  if not found then
    raise exception 'group_not_found';
  end if;
end;
$$;

-- 이미 소속이면 이름을 묻지 않고 넘어간다. 진행 중인 판이 있으면 그 id를 돌려준다 (4-5)
create function public.join_group(p_code text, p_display_name text default null)
returns table (group_id uuid, open_session_id uuid)
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_group_id uuid;
  v_display_name text;
begin
  select g.id into v_group_id from public.groups g where g.invite_code = upper(btrim(p_code));
  if v_group_id is null then
    raise exception 'group_not_found';
  end if;

  if not exists (
    select 1 from public.memberships m where m.group_id = v_group_id and m.user_id = v_uid
  ) then
    v_display_name := public.resolve_display_name(v_uid, p_display_name);
    begin
      insert into public.memberships (group_id, user_id, display_name)
      values (v_group_id, v_uid, v_display_name);
    exception when unique_violation then
      raise exception 'name_taken';
    end;
  end if;

  return query
    select v_group_id, (
      select s.id from public.sessions s
      where s.group_id = v_group_id and s.status <> 'done'
    );
end;
$$;

-- 판 (4-8 ~ 4-12) ---------------------------------------------------------

-- 진행 중인 판이 있으면 그것을, 없으면 새로 연다. 연 사람이 방장이다
create function public.start_session(p_group_id uuid) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_session_id uuid;
begin
  if not exists (
    select 1 from public.memberships m where m.group_id = p_group_id and m.user_id = v_uid
  ) then
    raise exception 'not_member';
  end if;

  select s.id into v_session_id
  from public.sessions s where s.group_id = p_group_id and s.status <> 'done';
  if v_session_id is not null then
    return v_session_id;
  end if;

  begin
    insert into public.sessions (group_id, host_user_id)
    values (p_group_id, v_uid)
    returning id into v_session_id;
  exception when unique_violation then
    -- 동시에 누른 사람이 먼저 열었다
    select s.id into v_session_id
    from public.sessions s where s.group_id = p_group_id and s.status <> 'done';
  end;
  return v_session_id;
end;
$$;

-- 세션 화면에 들어오면 참여자가 된다. 끝난 판이면 아무것도 바꾸지 않고 상태만 돌려준다
create function public.join_session(p_session_id uuid) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_session public.sessions := public.lock_session(p_session_id, v_uid);
begin
  if v_session.status = 'done' then
    return v_session.status;
  end if;

  insert into public.session_participants (session_id, user_id)
  values (p_session_id, v_uid)
  on conflict do nothing;
  if found then
    perform public.refresh_vetoes(p_session_id);
  end if;
  return v_session.status;
end;
$$;

create function public.add_candidate(p_session_id uuid, p_food_id bigint) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_session public.sessions := public.lock_session(p_session_id, v_uid);
  v_vetoed boolean;
begin
  perform public.require_participant(p_session_id, v_uid);
  if v_session.status <> 'open' then
    raise exception 'voting_started';
  end if;
  if not exists (select 1 from public.foods where id = p_food_id) then
    raise exception 'food_not_found';
  end if;

  begin
    insert into public.candidates (session_id, food_id, proposed_by)
    values (p_session_id, p_food_id, v_uid);
  exception when unique_violation then
    raise exception 'already_candidate';
  end;

  perform public.refresh_vetoes(p_session_id);
  select vetoed into v_vetoed
  from public.candidates where session_id = p_session_id and food_id = p_food_id;
  return v_vetoed;
end;
$$;

-- 내가 올린 후보의 어필. 빈 글은 지운다 (4-9)
create function public.set_pitch(p_session_id uuid, p_food_id bigint, p_pitch text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_session public.sessions := public.lock_session(p_session_id, v_uid);
  v_pitch text := nullif(btrim(coalesce(p_pitch, '')), '');
begin
  if v_session.status <> 'open' then
    raise exception 'voting_started';
  end if;
  if char_length(v_pitch) > 60 then
    raise exception 'pitch_too_long';
  end if;
  update public.candidates set pitch = v_pitch
  where session_id = p_session_id and food_id = p_food_id and proposed_by = v_uid;
  if not found then
    raise exception 'not_my_candidate';
  end if;
end;
$$;

create function public.remove_candidate(p_session_id uuid, p_food_id bigint) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_session public.sessions := public.lock_session(p_session_id, v_uid);
begin
  if v_session.status <> 'open' then
    raise exception 'voting_started';
  end if;
  delete from public.candidates
  where session_id = p_session_id and food_id = p_food_id and proposed_by = v_uid;
  if not found then
    raise exception 'not_my_candidate';
  end if;
end;
$$;

-- 방장만, 빠지지 않은 후보가 하나 이상일 때 (4-10)
create function public.open_voting(p_session_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_session public.sessions := public.lock_session(p_session_id, v_uid);
begin
  if v_session.host_user_id <> v_uid then
    raise exception 'not_host';
  end if;
  if v_session.status <> 'open' then
    raise exception 'not_open';
  end if;
  if not exists (
    select 1 from public.candidates where session_id = p_session_id and not vetoed
  ) then
    raise exception 'no_candidates';
  end if;
  update public.sessions set status = 'voting' where id = p_session_id;
end;
$$;

-- 누르면 찍힘과 취소가 바뀐다. 돌려주는 값은 누른 뒤 찍혀 있는지 (4-11)
create function public.cast_vote(p_session_id uuid, p_food_id bigint) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_session public.sessions := public.lock_session(p_session_id, v_uid);
  v_vetoed boolean;
  v_now_voted boolean;
begin
  if v_session.status <> 'voting' then
    raise exception 'not_voting';
  end if;
  -- 같은 사람이 동시에 누를 때 2표 상한이 깨지지 않게 참여자 줄을 잠근다
  perform 1 from public.session_participants
  where session_id = p_session_id and user_id = v_uid for update;
  if not found then
    raise exception 'not_participant';
  end if;

  select vetoed into v_vetoed
  from public.candidates where session_id = p_session_id and food_id = p_food_id;
  if v_vetoed is null then
    raise exception 'candidate_not_found';
  end if;
  if v_vetoed then
    raise exception 'candidate_vetoed';
  end if;

  delete from public.votes
  where session_id = p_session_id and user_id = v_uid and food_id = p_food_id;
  if found then
    v_now_voted := false;
  else
    if (select count(*) from public.votes where session_id = p_session_id and user_id = v_uid) >= 2 then
      raise exception 'vote_limit';
    end if;
    insert into public.votes (session_id, user_id, food_id) values (p_session_id, v_uid, p_food_id);
    v_now_voted := true;
  end if;

  update public.session_participants sp
  set voted = exists (select 1 from public.votes v where v.session_id = p_session_id and v.user_id = v_uid)
  where sp.session_id = p_session_id and sp.user_id = v_uid;
  return v_now_voted;
end;
$$;

-- 방장만. 표 수에 비례해 하나를 뽑고, 판을 끝내고, 식사 기록을 만든다 (4-12, 4-13)
create function public.spin_roulette(p_session_id uuid)
returns table (food_id bigint, meal_id uuid)
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_session public.sessions := public.lock_session(p_session_id, v_uid);
  v_food_ids bigint[];
  v_weights int[];
  v_food_id bigint;
  v_meal_id uuid;
begin
  if v_session.host_user_id <> v_uid then
    raise exception 'not_host';
  end if;
  if v_session.status <> 'voting' then
    raise exception 'not_voting';
  end if;

  -- 빠지지 않았고 1표 이상인 후보. 아무도 안 찍었으면 빠지지 않은 후보 전체를 1씩
  select array_agg(t.food_id order by t.food_id), array_agg(t.n order by t.food_id)
    into v_food_ids, v_weights
  from (
    select c.food_id, count(v.user_id)::int as n
    from public.candidates c
    left join public.votes v on v.session_id = c.session_id and v.food_id = c.food_id
    where c.session_id = p_session_id and not c.vetoed
    group by c.food_id
    having count(v.user_id) > 0
  ) t;

  if v_food_ids is null then
    select array_agg(c.food_id order by c.food_id), array_agg(1)
      into v_food_ids, v_weights
    from public.candidates c
    where c.session_id = p_session_id and not c.vetoed;
  end if;

  if v_food_ids is null then
    raise exception 'no_candidates';
  end if;

  v_food_id := public.pick_weighted(v_food_ids, v_weights, random());

  update public.sessions
  set status = 'done', decided_food_id = v_food_id, decided_at = now()
  where id = p_session_id;

  insert into public.meals (group_id, session_id, food_id)
  values (v_session.group_id, p_session_id, v_food_id)
  returning id into v_meal_id;

  insert into public.meal_participants (meal_id, user_id)
  select v_meal_id, sp.user_id from public.session_participants sp
  where sp.session_id = p_session_id;

  return query select v_food_id, v_meal_id;
end;
$$;

-- 끝난 판에서만 음식별 표 수. 누가 찍었는지는 돌려주지 않는다 (4-12)
create function public.session_vote_counts(p_session_id uuid)
returns table (food_id bigint, vote_count int, vetoed boolean)
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_status text;
begin
  select s.status into v_status from public.sessions s
  where s.id = p_session_id and public.is_session_member(s.id);
  if v_status is null then
    raise exception 'session_not_found';
  end if;
  if v_status <> 'done' then
    raise exception 'not_done';
  end if;

  return query
    select c.food_id, count(v.user_id)::int, c.vetoed
    from public.candidates c
    left join public.votes v on v.session_id = c.session_id and v.food_id = c.food_id
    where c.session_id = p_session_id
    group by c.food_id, c.vetoed
    order by c.food_id;
end;
$$;

-- 못 먹는 것 (4-7) --------------------------------------------------------

create function public.get_my_restrictions()
returns table (tag text, food_id bigint, kind text)
language sql stable security definer set search_path = ''
as $$
  select r.tag, r.food_id, r.kind
  from public.restrictions r
  where r.user_id = public.require_uid()
  order by r.id
$$;

-- 전체를 바꾼다. 빈 배열이면 전부 해제. 내가 참여한 진행 중인 판의 후보를 다시 판정한다.
-- p_items 예: [{"tag":"seafood","kind":"allergy"},{"food_id":3,"kind":"dislike"}]
create function public.set_my_restrictions(p_items jsonb) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_session_id uuid;
begin
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' then
    raise exception 'invalid_items';
  end if;

  delete from public.restrictions where user_id = v_uid;

  insert into public.restrictions (user_id, tag, food_id, kind)
  select v_uid, item ->> 'tag', (item ->> 'food_id')::bigint, item ->> 'kind'
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as item;

  for v_session_id in
    select s.id from public.sessions s
    join public.session_participants sp on sp.session_id = s.id
    where sp.user_id = v_uid and s.status <> 'done'
    order by s.id
    for update of s
  loop
    perform public.refresh_vetoes(v_session_id);
  end loop;
end;
$$;

-- 권한: 앱이 부르는 함수만 연다 ------------------------------------------

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.is_group_member(uuid),
  public.is_session_member(uuid),
  public.create_group(text, text),
  public.get_group_by_code(text),
  public.join_group(text, text),
  public.start_session(uuid),
  public.join_session(uuid),
  public.add_candidate(uuid, bigint),
  public.set_pitch(uuid, bigint, text),
  public.remove_candidate(uuid, bigint),
  public.open_voting(uuid),
  public.cast_vote(uuid, bigint),
  public.spin_roulette(uuid),
  public.session_vote_counts(uuid),
  public.get_my_restrictions(),
  public.set_my_restrictions(jsonb)
  to authenticated;
