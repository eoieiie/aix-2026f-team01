-- 0036 프로필 꾸미기, 취향, 맞춤 채우기 (명세 4-27, 2026-11-25)
-- 1. 프로필에 아바타(기본 메뉴 그림 하나), 단과대, 취향(좋아하는 종류, 매운맛, 한 끼 예산, 주로 먹는 때)을 더한다. 전부 선택 항목이다.
-- 2. 취향은 본인만 읽고 쓴다(profiles는 0006부터 본인 행만 읽는다. 쓰기는 save_my_prefs로만).
--    다른 사람에게는 아바타 그림만 나간다(visible_avatars). 단과대와 취향은 어떤 함수도 남에게 돌려주지 않는다.
-- 3. 빈 판 채우기(4-20)를 판 참여자 취향을 합친 점수 순으로 고른다(session_fill_picks).
--    고른 음식 id만 돌려주고 점수와 남의 취향은 내려보내지 않는다. 아무도 취향을 안 적었으면 0줄이고 앱은 예전처럼 무작위로 채운다.
-- 4. 계정을 지우면 profiles 줄이 auth.users와 함께 지워지므로 아바타, 단과대, 취향도 같이 지워진다.
-- 여러 번 돌려도 결과가 같다.

alter table public.profiles add column if not exists avatar_food_id bigint references public.foods (id) on delete set null;
alter table public.profiles add column if not exists college text;
alter table public.profiles add column if not exists fav_cuisines text[] not null default '{}';
alter table public.profiles add column if not exists spice_level smallint;
alter table public.profiles add column if not exists budget_level smallint;
alter table public.profiles add column if not exists meal_times text[] not null default '{}';

-- 고를 수 있는 값. src/constants/prefs.ts와 같아야 한다
create or replace function public.pref_cuisines() returns text[]
language sql immutable set search_path = ''
as $$ select array['korean','chinese','japanese','western','asian'] $$;

-- 한양대 ERICA 단과대 10곳 (hanyang.ac.kr/erica, 2026-11-25 확인)
create or replace function public.pref_colleges() returns text[]
language sql immutable set search_path = ''
as $$ select array['eng','computing','pharmacy','atc','gcc','cnc','cbe','design','sports_arts','lions'] $$;

create or replace function public.pref_meal_times() returns text[]
language sql immutable set search_path = ''
as $$ select array['lunch','dinner'] $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_college_check') then
    alter table public.profiles add constraint profiles_college_check
      check (college is null or college = any (public.pref_colleges()));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_fav_cuisines_check') then
    alter table public.profiles add constraint profiles_fav_cuisines_check
      check (fav_cuisines <@ public.pref_cuisines());
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_spice_level_check') then
    alter table public.profiles add constraint profiles_spice_level_check
      check (spice_level is null or spice_level between 0 and 3);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_budget_level_check') then
    alter table public.profiles add constraint profiles_budget_level_check
      check (budget_level is null or budget_level between 1 and 3);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_meal_times_check') then
    alter table public.profiles add constraint profiles_meal_times_check
      check (meal_times <@ public.pref_meal_times());
  end if;
end $$;

-- 레벨: 삼각수(1, 3, 6, 10…끼). src/api/stats.ts의 levelOf와 같다 (4-15)
create or replace function public.level_of(p_total int) returns int
language sql immutable set search_path = ''
as $$ select floor((sqrt(8 * greatest(coalesce(p_total, 0), 0) + 1) - 1) / 2)::int $$;

-- 처음부터 열려 있는 아바타 수
create or replace function public.avatar_starter_count() returns int
language sql immutable set search_path = ''
as $$ select 6 $$;

-- 내가 고를 수 있는 아바타 (4-27). 그림이 있는 기본 메뉴를 id 순으로 세운다.
-- 앞의 6개는 처음부터, 그 뒤는 레벨이 하나 오를 때마다 하나씩 열린다. 먹어 본 메뉴(도감)는 레벨과 상관없이 열린다.
create or replace function public.my_avatar_options()
returns table (food_id bigint, name text, image_path text, unlock_level int, eaten boolean, unlocked boolean)
language sql stable security definer set search_path = ''
as $$
  with me as (select public.require_uid() as uid),
  lv as (
    select public.level_of(
      (select count(*)::int from public.meal_participants mp where mp.user_id = (select uid from me))
    ) as level
  ),
  ord as (
    select f.id, f.name, f.image_path, (row_number() over (order by f.id))::int as pos
    from public.foods f
    where not coalesce(f.custom, false) and f.image_path is not null
  ),
  ate as (
    select distinct ml.food_id
    from public.meal_participants mp
    join public.meals ml on ml.id = mp.meal_id
    where mp.user_id = (select uid from me)
  )
  select o.id, o.name, o.image_path,
    greatest(o.pos - public.avatar_starter_count(), 0),
    a.food_id is not null,
    greatest(o.pos - public.avatar_starter_count(), 0) <= (select level from lv) or a.food_id is not null
  from ord o
  left join ate a on a.food_id = o.id
  order by o.pos
$$;

-- 내 아바타, 단과대, 취향. 프로필이 없으면 null
create or replace function public.my_prefs() returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'avatar_food_id', p.avatar_food_id,
    'avatar_image_path', f.image_path,
    'college', p.college,
    'fav_cuisines', to_jsonb(p.fav_cuisines),
    'spice_level', p.spice_level,
    'budget_level', p.budget_level,
    'meal_times', to_jsonb(p.meal_times)
  )
  from public.profiles p
  left join public.foods f on f.id = p.avatar_food_id
  where p.user_id = public.require_uid()
$$;

-- 넘긴 칸만 바꾼다. 칸이 있고 값이 null이면 지운다("말하지 않기"). 값은 서버가 다시 확인한다
create or replace function public.save_my_prefs(p_prefs jsonb) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_type text;
  v_avatar bigint;
  v_text text;
  v_int int;
  v_list text[];
begin
  if p_prefs is null or jsonb_typeof(p_prefs) <> 'object' then
    raise exception 'prefs_invalid';
  end if;
  if not exists (select 1 from public.profiles p where p.user_id = v_uid) then
    raise exception 'display_name_required';
  end if;

  if p_prefs ? 'avatar_food_id' then
    v_type := jsonb_typeof(p_prefs -> 'avatar_food_id');
    if v_type = 'null' then
      update public.profiles set avatar_food_id = null where user_id = v_uid;
    elsif v_type = 'number' and (p_prefs ->> 'avatar_food_id') ~ '^[0-9]+$' then
      v_avatar := (p_prefs ->> 'avatar_food_id')::bigint;
      if not exists (select 1 from public.my_avatar_options() o where o.food_id = v_avatar and o.unlocked) then
        raise exception 'avatar_locked';
      end if;
      update public.profiles set avatar_food_id = v_avatar where user_id = v_uid;
    else
      raise exception 'prefs_invalid';
    end if;
  end if;

  if p_prefs ? 'college' then
    v_type := jsonb_typeof(p_prefs -> 'college');
    v_text := p_prefs ->> 'college';
    if v_type = 'null' then
      update public.profiles set college = null where user_id = v_uid;
    elsif v_type = 'string' and v_text = any (public.pref_colleges()) then
      update public.profiles set college = v_text where user_id = v_uid;
    else
      raise exception 'prefs_invalid';
    end if;
  end if;

  if p_prefs ? 'fav_cuisines' then
    if jsonb_typeof(p_prefs -> 'fav_cuisines') <> 'array' then
      raise exception 'prefs_invalid';
    end if;
    select coalesce(array_agg(distinct e.value order by e.value), '{}') into v_list
    from jsonb_array_elements_text(p_prefs -> 'fav_cuisines') as e;
    if not (v_list <@ public.pref_cuisines()) then
      raise exception 'prefs_invalid';
    end if;
    update public.profiles set fav_cuisines = v_list where user_id = v_uid;
  end if;

  if p_prefs ? 'spice_level' then
    v_type := jsonb_typeof(p_prefs -> 'spice_level');
    if v_type = 'null' then
      update public.profiles set spice_level = null where user_id = v_uid;
    elsif v_type = 'number' and (p_prefs ->> 'spice_level') ~ '^[0-3]$' then
      v_int := (p_prefs ->> 'spice_level')::int;
      update public.profiles set spice_level = v_int where user_id = v_uid;
    else
      raise exception 'prefs_invalid';
    end if;
  end if;

  if p_prefs ? 'budget_level' then
    v_type := jsonb_typeof(p_prefs -> 'budget_level');
    if v_type = 'null' then
      update public.profiles set budget_level = null where user_id = v_uid;
    elsif v_type = 'number' and (p_prefs ->> 'budget_level') ~ '^[1-3]$' then
      v_int := (p_prefs ->> 'budget_level')::int;
      update public.profiles set budget_level = v_int where user_id = v_uid;
    else
      raise exception 'prefs_invalid';
    end if;
  end if;

  if p_prefs ? 'meal_times' then
    if jsonb_typeof(p_prefs -> 'meal_times') <> 'array' then
      raise exception 'prefs_invalid';
    end if;
    select coalesce(array_agg(distinct e.value order by e.value), '{}') into v_list
    from jsonb_array_elements_text(p_prefs -> 'meal_times') as e;
    if not (v_list <@ public.pref_meal_times()) then
      raise exception 'prefs_invalid';
    end if;
    update public.profiles set meal_times = v_list where user_id = v_uid;
  end if;

  return public.my_prefs();
end;
$$;

-- 내가 볼 수 있는 사람들의 아바타: 나, 같은 모임 사람, 같이 먹은 사람. 아바타 그림만 돌려준다(단과대, 취향은 없다)
create or replace function public.visible_avatars()
returns table (user_id uuid, food_id bigint, image_path text)
language sql stable security definer set search_path = ''
as $$
  with me as (select public.require_uid() as uid),
  seen as (
    select (select uid from me) as user_id
    union
    select m2.user_id
    from public.memberships m1
    join public.memberships m2 on m2.group_id = m1.group_id
    where m1.user_id = (select uid from me)
    union
    select mp2.user_id
    from public.meal_participants mp1
    join public.meal_participants mp2 on mp2.meal_id = mp1.meal_id
    where mp1.user_id = (select uid from me)
  )
  select p.user_id, p.avatar_food_id, f.image_path
  from seen s
  join public.profiles p on p.user_id = s.user_id
  join public.foods f on f.id = p.avatar_food_id
  where f.image_path is not null
$$;

-- 빈 판 채우기 (4-20, 4-27). 판 참여자만 부른다.
-- 점수 = 좋아하는 종류가 겹치는 사람 수 x 2
--      + 매운 음식이면 가장 약한 사람 기준(순한맛 -4, 조금 -2, 보통 0, 아주 매운맛 +1. 아무도 안 적었으면 0)
--      + 이 모임이 14일 안에 먹었으면 -3
-- 못 먹는 사람이 있는 음식, 직접 적은 메뉴, 이미 후보인 음식은 뺀다. 같은 점수는 무작위.
-- 아무도 좋아하는 종류나 매운맛을 안 적었으면 0줄(앱이 예전처럼 무작위로 채운다)
create or replace function public.session_fill_picks(p_session_id uuid, p_count int default 6)
returns table (food_id bigint, rank int)
language plpgsql volatile security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := public.require_uid();
  v_group uuid;
  v_min_spice int;
  v_recent_days constant int := 14;
begin
  if not exists (
    select 1 from public.session_participants sp
    where sp.session_id = p_session_id and sp.user_id = v_uid
  ) then
    raise exception 'not_member';
  end if;
  select s.group_id into v_group from public.sessions s where s.id = p_session_id;

  if not exists (
    select 1 from public.session_participants sp
    join public.profiles p on p.user_id = sp.user_id
    where sp.session_id = p_session_id
      and (cardinality(p.fav_cuisines) > 0 or p.spice_level is not null)
  ) then
    return;
  end if;

  select min(p.spice_level)::int into v_min_spice
  from public.session_participants sp
  join public.profiles p on p.user_id = sp.user_id
  where sp.session_id = p_session_id and p.spice_level is not null;

  return query
  with scored as (
    select f.id as fid,
      2 * (
        select count(*)::int from public.session_participants sp
        join public.profiles p on p.user_id = sp.user_id
        where sp.session_id = p_session_id and f.cuisine = any (p.fav_cuisines)
      )
      + case when 'spicy' = any (f.tags) then
          case v_min_spice when 0 then -4 when 1 then -2 when 3 then 1 else 0 end
        else 0 end
      + case when exists (
          select 1 from public.meals ml
          where ml.group_id = v_group and ml.food_id = f.id
            and ml.eaten_at > now() - make_interval(days => v_recent_days)
        ) then -3 else 0 end as score
    from public.foods f
    where not coalesce(f.custom, false)
      and not exists (
        select 1 from public.session_participants sp
        join public.restrictions r on r.user_id = sp.user_id
        where sp.session_id = p_session_id
          and public.restriction_blocks(f.id, f.tags, r.tag, r.food_id)
      )
      and not exists (
        select 1 from public.candidates c
        where c.session_id = p_session_id and c.food_id = f.id
      )
  ), ranked as (
    select s.fid, (row_number() over (order by s.score desc, random()))::int as rn
    from scored s
  )
  select r.fid, r.rn from ranked r
  where r.rn <= least(greatest(coalesce(p_count, 6), 1), 10)
  order by r.rn;
end;
$$;

revoke execute on function
  public.pref_cuisines(), public.pref_colleges(), public.pref_meal_times(), public.level_of(int),
  public.avatar_starter_count(), public.my_avatar_options(), public.my_prefs(), public.save_my_prefs(jsonb),
  public.visible_avatars(), public.session_fill_picks(uuid, int)
  from public, anon;
grant execute on function
  public.my_avatar_options(), public.my_prefs(), public.save_my_prefs(jsonb),
  public.visible_avatars(), public.session_fill_picks(uuid, int)
  to authenticated;
