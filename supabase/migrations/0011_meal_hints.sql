-- 0011 식사 기록을 판에 다시 쓰기 (명세 4-20, 이슈 #63 초안의 1, 2번과 빈 판 채우기)
-- 판에서 음식마다 세 가지를 돌려준다.
--   blocked: 지금 이 판 참여자 중 못 먹는 사람이 있는지 (누구인지는 없다)
--   eaten_count, last_eaten_at: 이 모임이 그 음식을 몇 번, 마지막으로 언제 먹었는지
-- 앱은 이것으로 "N일 전에 먹었어요", "이 모임 단골", "모두 먹을 수 있는 메뉴 채우기"를 그린다.
-- 표시와 후보 올리기만 돕는다. 투표, 룰렛 확률은 바꾸지 않는다.
-- 직접 적은 메뉴(custom)는 빼서, 그 이름이 다른 판 사람에게 보이지 않게 한다.

create or replace function public.session_food_hints(p_session_id uuid)
returns table (food_id bigint, blocked boolean, eaten_count int, last_eaten_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_group uuid;
begin
  if not public.is_session_member(p_session_id) then
    raise exception 'not_member';
  end if;
  select s.group_id into v_group from public.sessions s where s.id = p_session_id;

  return query
  select
    f.id,
    exists (
      select 1 from public.session_participants sp
      join public.restrictions r on r.user_id = sp.user_id
      where sp.session_id = p_session_id
        and public.restriction_blocks(f.id, f.tags, r.tag, r.food_id)
    ),
    coalesce(m.n, 0)::int,
    m.last_at
  from public.foods f
  left join (
    select ml.food_id, count(*) as n, max(ml.eaten_at) as last_at
    from public.meals ml where ml.group_id = v_group
    group by ml.food_id
  ) m on m.food_id = f.id
  where not coalesce(f.custom, false)
  order by f.id;
end;
$$;

revoke execute on function public.session_food_hints(uuid) from public, anon;
grant execute on function public.session_food_hints(uuid) to authenticated;
