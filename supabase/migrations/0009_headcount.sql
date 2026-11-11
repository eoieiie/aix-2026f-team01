-- 0009 먹을 인원수 (명세 4-6, 4-12)
-- 판을 열 때 방장이 "몇 명이서 먹는지" 고른다. 그 수만큼 골라야(투표해야) 방장이 돌릴 수 있다.
-- 오지 않는 사람이 있으면 방장이 판 화면에서 수를 바꾼다.
-- 이미 있던 판은 인원수가 비어 있고, 예전처럼 언제든 돌릴 수 있다.
-- 여러 번 돌려도 같은 결과가 되게 썼다 (0008과 같은 방식).

alter table public.sessions add column if not exists expected_count int;
do $$ begin
  alter table public.sessions add constraint sessions_expected_count_range
    check (expected_count is null or expected_count between 1 and 20);
exception when duplicate_object then null; end $$;

-- 판 열기: 인원수를 함께 받는다. 앱 예전 판(인원수 없이 부름)도 그대로 된다
drop function if exists public.start_session(uuid);
create or replace function public.start_session(p_group_id uuid, p_expected_count int default null)
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

  -- 진행 중인 판이 있으면 그 판으로. 인원수는 바꾸지 않는다
  select s.id into v_session_id
  from public.sessions s where s.group_id = p_group_id and s.status <> 'done';
  if v_session_id is not null then
    return v_session_id;
  end if;

  begin
    insert into public.sessions (group_id, host_user_id, expected_count)
    values (p_group_id, v_uid, p_expected_count)
    returning id into v_session_id;
  exception when unique_violation then
    select s.id into v_session_id
    from public.sessions s where s.group_id = p_group_id and s.status <> 'done';
  end;
  return v_session_id;
end;
$$;

-- 방장만, 끝나기 전에만 인원수를 바꾼다
create or replace function public.set_expected_count(p_session_id uuid, p_count int)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_session public.sessions := public.lock_session(p_session_id, v_uid);
begin
  if v_session.host_user_id <> v_uid then
    raise exception 'not_host';
  end if;
  if v_session.status = 'done' then
    raise exception 'not_voting';
  end if;
  if p_count is null or p_count < 1 or p_count > 20 then
    raise exception 'bad_headcount';
  end if;
  update public.sessions set expected_count = p_count where id = p_session_id;
end;
$$;

-- 돌리기: 인원수만큼 고르기 전에는 막는다. 나머지는 0003과 같다
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

revoke execute on function public.start_session(uuid, int), public.set_expected_count(uuid, int)
  from public, anon;
grant execute on function public.start_session(uuid, int), public.set_expected_count(uuid, int),
  public.spin_roulette(uuid) to authenticated;
