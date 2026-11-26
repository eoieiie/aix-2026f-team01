-- 시연 자료를 기존 사용자 계정으로 넓히기 (2026-11-26, 명세 4-32)
-- 대상 계정의 예전 모임은 지우지 않고 숨긴다: 구성원 줄을 demo_hidden_memberships로 옮기면 홈과 모임 화면에서 빠진다.
-- 판, 식사 기록, 직접 적은 메뉴는 표에 그대로 남고 실측 조회(scripts/usage-stats.sql 등)는 그대로 센다.
-- 내 프로필 숫자(끼니, 도감, 밥 친구)와 결과 카드의 "N번째"에는 숨긴 모임의 식사를 섞지 않는다.
-- 되돌리기: scripts/demo-seed-restore.sql. 여러 번 돌려도 같다.

create table if not exists public.demo_hidden_memberships (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null,
  joined_at timestamptz,
  hidden_at timestamptz not null default now(),
  was_member boolean not null default true,   -- false: 이미 나간 모임(식사 기록만 있음). 되돌릴 때 구성원 줄을 만들지 않는다
  primary key (group_id, user_id)
);
alter table public.demo_hidden_memberships add column if not exists was_member boolean not null default true;
alter table public.demo_hidden_memberships enable row level security;
revoke all on table public.demo_hidden_memberships from anon, authenticated;

create or replace function public.is_hidden_group_for(p_group_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.demo_hidden_memberships h where h.group_id = p_group_id and h.user_id = p_user_id);
$$;

-- 시연용 계정: 원본 가상 인물(mark)과 로그인하지 않는 시연용 친구(seed)
create or replace function public.is_demo_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.demo_seed d where d.table_name = 'profiles' and d.row_id = p_user_id::text);
$$;

revoke execute on function public.is_hidden_group_for(uuid, uuid), public.is_demo_user(uuid) from public, anon, authenticated;

create or replace function public.my_food_counts()
 RETURNS TABLE(food_id bigint, meal_count integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select ml.food_id, count(*)::int
  from public.meal_participants mp
  join public.meals ml on ml.id = mp.meal_id
  where mp.user_id = public.require_uid()
    and not public.is_hidden_group_for(ml.group_id, mp.user_id)
  group by ml.food_id
  order by 2 desc, 1
$function$;

create or replace function public.my_food_dex()
 RETURNS TABLE(food_id bigint, name text, image_path text, custom boolean, meal_count integer, first_eaten timestamp with time zone, last_eaten timestamp with time zone, companion_count integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with mine as (
    select ml.id as meal_id, ml.food_id, ml.eaten_at
    from public.meal_participants mp
    join public.meals ml on ml.id = mp.meal_id
    where mp.user_id = public.require_uid()
      and not public.is_hidden_group_for(ml.group_id, mp.user_id)
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
$function$;

create or replace function public.my_companions()
 RETURNS TABLE(user_id uuid, display_name text, meal_count integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select other.user_id, p.display_name, count(*)::int
  from public.meal_participants me
  join public.meal_participants other on other.meal_id = me.meal_id and other.user_id <> me.user_id
  join public.profiles p on p.user_id = other.user_id
  join public.meals ml on ml.id = me.meal_id
  where me.user_id = public.require_uid()
    and not public.is_hidden_group_for(ml.group_id, me.user_id)
  group by other.user_id, p.display_name
  order by 3 desc, 2, 1
$function$;

create or replace function public.meal_card(p_meal_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
      and ml.eaten_at <= v_meal.eaten_at
      and not public.is_hidden_group_for(ml.group_id, v_uid);
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
          and not public.is_hidden_group_for(ml.group_id, v_uid)
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
$function$;

grant execute on function public.my_food_counts(), public.my_food_dex(), public.my_companions(), public.meal_card(uuid) to authenticated;
