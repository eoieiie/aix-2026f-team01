-- 0049 내 추천 (명세 4-27). 내 기록으로만 메뉴를 고르고, 이 판의 확실한 충돌은 기존 검색 힌트처럼 뒤로 보낸다.
-- 이미 있는 항목만 읽고 음식 번호와 이름만 돌려준다. 점수나 못 먹는 사람이 누구인지는 돌려주지 않는다.
create or replace function public.my_food_picks(p_session_id uuid, p_count int default 3)
returns table (food_id bigint, name text)
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_cuisines text[];
  -- src/constants/index.ts의 RECENT_EATEN_DAYS와 같은 값
  v_recent_days constant int := 14;
begin
  perform public.require_participant(p_session_id, v_uid);

  select p.fav_cuisines into v_cuisines from public.profiles p where p.user_id = v_uid;

  return query
  with my_finished as materialized (
    select s.id, s.decided_food_id
    from public.session_participants sp
    join public.sessions s on s.id = sp.session_id and s.status = 'done'
    where sp.user_id = v_uid
  ), my_history as materialized (
    select e.fid, sum(e.weight) as weight, max(e.eaten_at) as last_eaten_at
    from (
      select v.food_id as fid, 2 as weight, null::timestamptz as eaten_at
      from my_finished s join public.votes v on v.session_id = s.id and v.user_id = v_uid
      union all
      select s.decided_food_id, 1, null::timestamptz
      from my_finished s where s.decided_food_id is not null
      union all
      select m.food_id, 1, m.eaten_at
      from public.meal_participants mp join public.meals m on m.id = mp.meal_id
      where mp.user_id = v_uid
    ) e
    group by e.fid
  ), restrictions_here as materialized (
    select r.user_id, r.tag, r.food_id
    from public.session_participants sp
    join public.restrictions r on r.user_id = sp.user_id
    where sp.session_id = p_session_id
  )
  select f.id, f.name
  from public.foods f
  left join my_history h on h.fid = f.id
  where (coalesce(cardinality(v_cuisines), 0) > 0 or exists (select 1 from my_history))
    -- 직접 적은 이름은 내 기록에 있는 것만 본다.
    and (not f.custom or h.fid is not null)
    and not exists (select 1 from public.candidates c where c.session_id = p_session_id and c.food_id = f.id)
    and not exists (
      select 1 from restrictions_here r where r.user_id = v_uid
        and public.restriction_blocks(f.id, f.tags, r.tag, r.food_id)
    )
  order by
    -- 모임의 확실한 충돌을 가장 뒤로, 내 약한 충돌과 최근 먹은 음식은 그다음으로 보낸다.
    exists (
      select 1 from restrictions_here r where r.user_id <> v_uid
        and public.restriction_blocks(f.id, f.tags, r.tag, r.food_id)
    ),
    exists (
      select 1 from restrictions_here r
      where r.user_id = v_uid and r.tag is not null
        and (f.ai_tags || f.soft_tags) && public.diet_ingredients(r.tag)
    ),
    coalesce(h.last_eaten_at > now() - make_interval(days => v_recent_days), false),
    (case when f.cuisine = any(v_cuisines) then 4 else 0 end + coalesce(h.weight, 0)) desc,
    random()
  limit least(greatest(coalesce(p_count, 3), 0), 10);
end;
$$;

revoke execute on function public.my_food_picks(uuid, int) from public, anon;
grant execute on function public.my_food_picks(uuid, int) to authenticated;
