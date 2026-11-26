-- 0030 음식 도감과 모임 식사 타임라인 (명세 4-25, 2026-11-25)
-- 쌓이는 기록을 보여 주는 읽기 함수 둘. 새 표는 없다. 지어낸 숫자 없이 meals, meal_participants에서만 센다

-- 내 음식 도감: 기본 음식 40개는 먹지 않았어도 모두 돌려준다(빈칸 자리). 직접 적은 메뉴는 내가 먹은 것만.
-- companion_count: 그 메뉴를 나와 같은 끼니에 먹은 다른 사람 수(서로 다른 사람)
create or replace function public.my_food_dex()
returns table (
  food_id bigint, name text, image_path text, custom boolean,
  meal_count int, first_eaten timestamptz, last_eaten timestamptz, companion_count int
)
language sql stable security definer set search_path = ''
as $$
  with mine as (
    select ml.id as meal_id, ml.food_id, ml.eaten_at
    from public.meal_participants mp
    join public.meals ml on ml.id = mp.meal_id
    where mp.user_id = public.require_uid()
  ), agg as (
    select m.food_id, count(*)::int as meal_count, min(m.eaten_at) as first_eaten, max(m.eaten_at) as last_eaten,
      (select count(distinct mp2.user_id)::int from public.meal_participants mp2
        join mine m2 on m2.meal_id = mp2.meal_id
        where m2.food_id = m.food_id and mp2.user_id <> public.require_uid()) as companion_count
    from mine m group by m.food_id
  )
  select f.id, f.name, f.image_path, f.custom,
    coalesce(a.meal_count, 0), a.first_eaten, a.last_eaten, coalesce(a.companion_count, 0)
  from public.foods f
  left join agg a on a.food_id = f.id
  where (not f.custom) or a.food_id is not null
  order by f.custom, f.id
$$;

-- 모임 식사 타임라인: 그 모임 멤버만. 끼니마다 함께 먹은 사람 이름(모임 안 이름)
create or replace function public.group_meal_timeline(p_group_id uuid, p_limit int default 60)
returns table (
  meal_id uuid, food_id bigint, food_name text, cuisine text, image_path text,
  eaten_at timestamptz, eaters text[]
)
language plpgsql stable security definer set search_path = ''
as $$
declare v_uid uuid := public.require_uid();
begin
  if not exists (select 1 from public.memberships where group_id = p_group_id and user_id = v_uid) then
    raise exception 'not_member';
  end if;
  return query
    select ml.id, ml.food_id, f.name, f.cuisine, f.image_path, ml.eaten_at,
      coalesce((select array_agg(ms.display_name order by ms.display_name)
        from public.meal_participants mp
        join public.memberships ms on ms.group_id = ml.group_id and ms.user_id = mp.user_id
        where mp.meal_id = ml.id), array[]::text[])
    from public.meals ml
    join public.foods f on f.id = ml.food_id
    where ml.group_id = p_group_id
    order by ml.eaten_at desc
    limit greatest(1, least(coalesce(p_limit, 60), 200));
end;
$$;

revoke execute on function public.my_food_dex(), public.group_meal_timeline(uuid, int) from public, anon;
grant execute on function public.my_food_dex(), public.group_meal_timeline(uuid, int) to authenticated;
