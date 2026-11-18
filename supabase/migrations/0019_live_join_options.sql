-- 0019 초대 실시간, 방장 옵션(인당 표 수, 한 메뉴에 여러 표), 모임 카드 네 글자 평균 조건 (명세 4-6, 4-8, 4-12, 4-16, 2026-11-18)

-- 1. 누가 초대 링크, QR로 들어오면 모임 화면이 바로 다시 읽도록 memberships를 실시간에 더한다.
--    구독도 RLS(memberships_select: 같은 모임 사람만)를 따른다.
alter publication supabase_realtime add table public.memberships;

-- 2. 방장 옵션. 판마다 인당 표 수(1~3, 기본 2)와 한 메뉴에 여러 표 주기(기본 끔)
alter table public.sessions
  add column vote_limit int not null default 2 check (vote_limit between 1 and 3),
  add column allow_repeat boolean not null default false;

-- 한 메뉴에 준 표 수. 여러 표 주기가 꺼진 판은 늘 1이다
alter table public.votes
  add column weight int not null default 1 check (weight between 1 and 3);

-- start_session에 옵션 두 인자를 더한다. 인자가 늘어 이름이 같은 함수가 둘이 되지 않게 옛 것을 지운다.
-- 옛 호출(모임 id, 인원수)은 기본값으로 그대로 동작한다
drop function public.start_session(uuid, int);

create function public.start_session(
  p_group_id uuid,
  p_expected_count int default null,
  p_vote_limit int default 2,
  p_allow_repeat boolean default false
)
returns uuid
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
  if p_expected_count is not null and (p_expected_count < 1 or p_expected_count > 20) then
    raise exception 'bad_headcount';
  end if;
  if p_vote_limit is null or p_vote_limit < 1 or p_vote_limit > 3 then
    raise exception 'bad_vote_limit';
  end if;

  -- 진행 중인 판이 있으면 그 판으로. 인원수는 바꾸지 않는다
  select s.id into v_session_id
  from public.sessions s where s.group_id = p_group_id and s.status <> 'done';
  if v_session_id is not null then
    return v_session_id;
  end if;

  begin
    insert into public.sessions (group_id, host_user_id, expected_count, vote_limit, allow_repeat)
    values (p_group_id, v_uid, p_expected_count, p_vote_limit, coalesce(p_allow_repeat, false))
    returning id into v_session_id;
  exception when unique_violation then
    select s.id into v_session_id
    from public.sessions s where s.group_id = p_group_id and s.status <> 'done';
  end;
  return v_session_id;
end;
$$;

-- 투표: 판의 vote_limit과 allow_repeat을 따른다. 쓴 표 수는 weight의 합
create or replace function public.cast_vote(p_session_id uuid, p_food_id bigint) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_session public.sessions := public.lock_session(p_session_id, v_uid);
  v_now_voted boolean;
  v_used int;
  v_weight int;
begin
  if v_session.status <> 'voting' then
    raise exception 'not_voting';
  end if;
  perform 1 from public.session_participants
  where session_id = p_session_id and user_id = v_uid for update;
  if not found then
    raise exception 'not_participant';
  end if;
  if not exists (
    select 1 from public.candidates where session_id = p_session_id and food_id = p_food_id
  ) then
    raise exception 'candidate_not_found';
  end if;

  select coalesce(sum(weight), 0)::int into v_used
  from public.votes where session_id = p_session_id and user_id = v_uid;
  select weight into v_weight
  from public.votes where session_id = p_session_id and user_id = v_uid and food_id = p_food_id;

  if v_weight is not null then
    -- 이미 찍은 메뉴: 여러 표 주기가 켜져 있고 표가 남으면 한 표 더, 아니면 이 메뉴의 표를 모두 거둔다
    if v_session.allow_repeat and v_used < v_session.vote_limit then
      update public.votes set weight = weight + 1
      where session_id = p_session_id and user_id = v_uid and food_id = p_food_id;
      v_now_voted := true;
    else
      delete from public.votes
      where session_id = p_session_id and user_id = v_uid and food_id = p_food_id;
      v_now_voted := false;
    end if;
  else
    if v_used >= v_session.vote_limit then
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

-- 룰렛 무게와 결과 표 수도 weight의 합으로 센다
create or replace function public.spin_roulette(p_session_id uuid)
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
  if v_session.expected_count is not null and (
    select count(*) from public.session_participants sp
    where sp.session_id = p_session_id and sp.voted
  ) < v_session.expected_count then
    raise exception 'not_all_voted';
  end if;

  select array_agg(t.food_id order by t.food_id), array_agg(t.n order by t.food_id)
    into v_food_ids, v_weights
  from (
    select c.food_id, coalesce(sum(v.weight), 0)::int as n
    from public.candidates c
    left join public.votes v on v.session_id = c.session_id and v.food_id = c.food_id
    where c.session_id = p_session_id
    group by c.food_id
    having coalesce(sum(v.weight), 0) > 0
  ) t;

  -- 아무도 찍지 않았으면(다 "아무거나 괜찮아요") 못 먹는 사람이 없는 후보에서 똑같이. 그런 후보가 없으면 전체에서
  if v_food_ids is null then
    select array_agg(c.food_id order by c.food_id), array_agg(1)
      into v_food_ids, v_weights
    from public.candidates c
    where c.session_id = p_session_id and not c.vetoed;
  end if;
  if v_food_ids is null then
    select array_agg(c.food_id order by c.food_id), array_agg(1)
      into v_food_ids, v_weights
    from public.candidates c
    where c.session_id = p_session_id;
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

create or replace function public.session_vote_counts(p_session_id uuid)
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
    select c.food_id, coalesce(sum(v.weight), 0)::int, c.vetoed
    from public.candidates c
    left join public.votes v on v.session_id = c.session_id and v.food_id = c.food_id
    where c.session_id = p_session_id
    group by c.food_id, c.vetoed
    order by c.food_id;
end;
$$;


-- 3. 모임 카드: 네 글자 평균은 만든 사람이 1명이면 보인다. 네 글자는 취향이라 숨길 이유가 적다.
--    못 먹는 것 집계(tag_counts, food_block_count)는 3명 미만이면 그대로 null이다.
--    2명 모임에서 "할랄 1명"이 보이면 상대가 누구인지 바로 알 수 있고, 종교와 신념은 민감 정보라서다

-- 인원수만 돌려준다. 사람이 적으면 숫자만으로 누구인지 드러나므로 3명 미만은 null이다
create or replace function public.group_profile_card(p_group_id uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_min_people constant int := 3;
  v_min_tested constant int := 1;
  v_member_count int;
  v_tag_counts jsonb;
  v_food_block_count int;
  v_tested_count int;
  v_axes jsonb;
begin
  perform public.require_uid();
  if not public.is_group_member(p_group_id) then
    raise exception 'not_member';
  end if;

  select count(*)::int into v_member_count
  from public.memberships m
  where m.group_id = p_group_id;

  if v_member_count >= v_min_people then
    select coalesce(jsonb_agg(jsonb_build_object('tag', t.tag, 'count', t.people) order by t.people desc, t.tag), '[]'::jsonb)
    into v_tag_counts
    from (
      select r.tag, count(*)::int as people
      from public.restrictions r
      join public.memberships m on m.user_id = r.user_id and m.group_id = p_group_id
      where r.tag is not null
      group by r.tag
    ) t;

    select count(distinct r.user_id)::int into v_food_block_count
    from public.restrictions r
    join public.memberships m on m.user_id = r.user_id and m.group_id = p_group_id
    where r.food_id is not null;
  end if;

  select count(*)::int into v_tested_count
  from public.memberships m
  join public.profiles p on p.user_id = m.user_id
  where m.group_id = p_group_id and p.quiz_answers is not null;

  if v_tested_count >= v_min_tested then
    select jsonb_build_object(
      'explore', round(avg((p.axes ->> 'explore')::numeric), 2),
      'spicy', round(avg((p.axes ->> 'spicy')::numeric), 2),
      'korean', round(avg((p.axes ->> 'korean')::numeric), 2),
      'lead', round(avg((p.axes ->> 'lead')::numeric), 2)
    )
    into v_axes
    from public.memberships m
    join public.profiles p on p.user_id = m.user_id
    where m.group_id = p_group_id and p.quiz_answers is not null;
  end if;

  return jsonb_build_object(
    'member_count', v_member_count,
    'tag_counts', v_tag_counts,
    'food_block_count', v_food_block_count,
    'tested_count', v_tested_count,
    'axes', v_axes
  );
end;
$$;

revoke execute on function public.start_session(uuid, int, int, boolean) from public, anon;
grant execute on function public.start_session(uuid, int, int, boolean) to authenticated;
