-- 0010 못 먹는 후보를 빼지 않고 알리기, "아무거나 괜찮아요" (명세 4-9, 4-11, 4-12)
-- 11/11 결정: 못 먹는 사람이 있는 후보도 찍을 수 있고 룰렛에도 들어간다.
-- 대신 투표 화면 위에 "돼지고기 못 먹는 사람이 있어요"처럼 무엇이 걸리는지 보인다. 누구인지는 여전히 없다.
-- candidates.vetoed는 "못 먹는 사람이 있다"는 표시로 남긴다.
-- 인터뷰 2(#44): 아무거나 먹어도 되는 사람은 고르지 않고 "아무거나 괜찮아요"로 투표를 마친다.
-- 여러 번 돌려도 같은 결과가 되게 썼다.

-- 투표 열기: 후보가 하나라도 있으면 된다
create or replace function public.open_voting(p_session_id uuid) returns void
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
  if not exists (select 1 from public.candidates where session_id = p_session_id) then
    raise exception 'no_candidates';
  end if;
  update public.sessions set status = 'voting' where id = p_session_id;
end;
$$;

-- 찍기: 못 먹는 사람이 있는 후보도 찍을 수 있다
create or replace function public.cast_vote(p_session_id uuid, p_food_id bigint) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_session public.sessions := public.lock_session(p_session_id, v_uid);
  v_now_voted boolean;
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

  delete from public.votes
  where session_id = p_session_id and user_id = v_uid and food_id = p_food_id;
  if found then
    v_now_voted := false;
  else
    if (select count(*) from public.votes where session_id = p_session_id and user_id = v_uid)
        >= public.app_limit('MAX_VOTES_PER_PERSON') then
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

-- 아무거나 괜찮아요: 내 표를 지우고 투표한 것으로 친다. 다시 누르면 취소. 돌려주는 값은 누른 뒤 상태
create or replace function public.set_any_ok(p_session_id uuid) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_session public.sessions := public.lock_session(p_session_id, v_uid);
  v_was boolean;
  v_has_votes boolean;
begin
  if v_session.status <> 'voting' then
    raise exception 'not_voting';
  end if;
  select voted into v_was from public.session_participants
  where session_id = p_session_id and user_id = v_uid for update;
  if v_was is null then
    raise exception 'not_participant';
  end if;
  v_has_votes := exists (
    select 1 from public.votes where session_id = p_session_id and user_id = v_uid
  );
  if v_was and not v_has_votes then
    update public.session_participants set voted = false
    where session_id = p_session_id and user_id = v_uid;
    return false;
  end if;
  delete from public.votes where session_id = p_session_id and user_id = v_uid;
  update public.session_participants set voted = true
  where session_id = p_session_id and user_id = v_uid;
  return true;
end;
$$;

-- 이 판 후보에 걸리는 못 먹는 것. 재료/식단 태그, 또는 음식 이름. 누가 적었는지는 돌려주지 않는다
create or replace function public.session_cant_eat(p_session_id uuid)
returns table (tag text, food_name text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_session_member(p_session_id) then
    raise exception 'not_member';
  end if;
  return query
  select distinct r.tag, rf.name
  from public.session_participants sp
  join public.restrictions r on r.user_id = sp.user_id
  left join public.foods rf on rf.id = r.food_id
  join public.candidates c on c.session_id = sp.session_id
  join public.foods f on f.id = c.food_id
  where sp.session_id = p_session_id
    and public.restriction_blocks(f.id, f.tags, r.tag, r.food_id)
  order by 1, 2;
end;
$$;

-- 돌리기: 표를 받은 후보는 못 먹는 사람이 있어도 대상이다. 인원수 확인은 0009와 같다
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
    select c.food_id, count(v.user_id)::int as n
    from public.candidates c
    left join public.votes v on v.session_id = c.session_id and v.food_id = c.food_id
    where c.session_id = p_session_id
    group by c.food_id
    having count(v.user_id) > 0
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

revoke execute on function public.set_any_ok(uuid), public.session_cant_eat(uuid) from public, anon;
grant execute on function public.set_any_ok(uuid), public.session_cant_eat(uuid),
  public.open_voting(uuid), public.cast_vote(uuid, bigint), public.spin_roulette(uuid) to authenticated;
