-- 0013 결과 카드에 "이번 달 이 모임은 한식 N번"과 음식 이름 더하기 (명세 4-17, 이슈 #63 3번, #43)
-- meal_card(0006)의 기존 칸은 그대로 두고 두 칸을 더한다.
--   food_name: 음식 이름. 직접 적은 메뉴도 이 모임 소속이면 보인다
--   group_month_cuisine: {cuisine, count}. 이 식사가 있는 달(한국 시간)에 이 모임이 같은 종류(korean 등)를 먹은 수, 이 식사까지.
--     음식 종류가 없으면(직접 적은 메뉴 등) null
-- 못 먹는 것은 돌려주지 않는다. 여러 번 돌려도 같은 결과가 되게 create or replace로 썼다.

create or replace function public.meal_card(p_meal_id uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_meal public.meals;
  v_group_name text;
  v_group_food_nth int;
  v_my_food_nth int;
  v_people jsonb;
  v_food_name text;
  v_cuisine text;
  v_month_count int;
begin
  select * into v_meal from public.meals ml where ml.id = p_meal_id;
  if not found then
    raise exception 'meal_not_found';
  end if;
  if not public.is_group_member(v_meal.group_id) then
    raise exception 'not_member';
  end if;

  select g.name into v_group_name from public.groups g where g.id = v_meal.group_id;
  select f.name, f.cuisine into v_food_name, v_cuisine from public.foods f where f.id = v_meal.food_id;

  -- 이번 달(한국 시간, 이 식사가 있는 달) 이 모임이 같은 종류(한식 등)를 먹은 수. 이 식사까지 센다
  if v_cuisine is not null then
    select count(*)::int into v_month_count
    from public.meals ml
    join public.foods f on f.id = ml.food_id
    where ml.group_id = v_meal.group_id
      and f.cuisine = v_cuisine
      and ml.eaten_at <= v_meal.eaten_at
      and date_trunc('month', ml.eaten_at at time zone 'Asia/Seoul')
        = date_trunc('month', v_meal.eaten_at at time zone 'Asia/Seoul');
  end if;

  select count(*)::int into v_group_food_nth
  from public.meals ml
  where ml.group_id = v_meal.group_id
    and ml.food_id = v_meal.food_id
    and ml.eaten_at <= v_meal.eaten_at;

  if exists (
    select 1 from public.meal_participants mp
    where mp.meal_id = p_meal_id and mp.user_id = v_uid
  ) then
    select count(*)::int into v_my_food_nth
    from public.meal_participants mp
    join public.meals ml on ml.id = mp.meal_id
    where mp.user_id = v_uid
      and ml.food_id = v_meal.food_id
      and ml.eaten_at <= v_meal.eaten_at;
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'user_id', mp.user_id,
      'display_name', m.display_name,
      'together_nth', case when mp.user_id = v_uid then null else (
        select count(*)::int
        from public.meal_participants me
        join public.meal_participants other on other.meal_id = me.meal_id
        join public.meals ml on ml.id = me.meal_id
        where me.user_id = v_uid
          and other.user_id = mp.user_id
          and ml.eaten_at <= v_meal.eaten_at
      ) end
    )
    order by m.display_name, mp.user_id
  )
  into v_people
  from public.meal_participants mp
  join public.memberships m on m.group_id = v_meal.group_id and m.user_id = mp.user_id
  where mp.meal_id = p_meal_id;

  return jsonb_build_object(
    'group_name', v_group_name,
    'eaten_at', v_meal.eaten_at,
    'food_id', v_meal.food_id,
    'group_food_nth', v_group_food_nth,
    'my_food_nth', v_my_food_nth,
    'people', coalesce(v_people, '[]'::jsonb),
    'food_name', v_food_name,
    'group_month_cuisine', case when v_cuisine is null then null
      else jsonb_build_object('cuisine', v_cuisine, 'count', v_month_count) end
  );
end;
$$;

revoke execute on function public.meal_card(uuid) from public, anon;
grant execute on function public.meal_card(uuid) to authenticated;
