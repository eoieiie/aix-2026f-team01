-- 명세 5절 서버 함수(2단계). 프로필 저장과 집계, profiles 권한 좁히기.

-- 아이디 길이와 문항 수 (4-14). src/constants/index.ts와 같아야 한다
create or replace function public.app_limits() returns jsonb
language sql immutable set search_path = ''
as $$
  select '{"GROUP_NAME_MAX": 40, "DISPLAY_NAME_MAX": 20, "INVITE_CODE_LENGTH": 6, "PITCH_MAX": 60, "MAX_VOTES_PER_PERSON": 2, "HANDLE_MIN": 3, "HANDLE_MAX": 16, "QUIZ_LENGTH": 8}'::jsonb
$$;

-- 내 프로필 (4-14) --------------------------------------------------------

-- 생략한 칸은 그대로 둔다. 프로필이 없으면 이름을 받아 만든다.
-- 축 점수는 서버가 계산한다. 문항 두 개씩 한 축이고, A는 +1, B는 -1의 평균이다
create function public.save_my_profile(
  p_display_name text default null,
  p_handle text default null,
  p_quiz_answers jsonb default null
)
returns table (display_name text, handle text, axes jsonb)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := public.require_uid();
  v_name text;
  v_scores int[];
  v_axes jsonb;
begin
  if p_display_name is not null then
    v_name := public.clean_name(p_display_name, public.app_limit('DISPLAY_NAME_MAX'));
  end if;

  if p_handle is not null and (
    p_handle !~ '^[a-z0-9_]+$'
    or char_length(p_handle) not between public.app_limit('HANDLE_MIN') and public.app_limit('HANDLE_MAX')
  ) then
    raise exception 'handle_invalid';
  end if;

  if p_quiz_answers is not null then
    if jsonb_typeof(p_quiz_answers) <> 'array'
      or jsonb_array_length(p_quiz_answers) <> public.app_limit('QUIZ_LENGTH')
      or exists (
        select 1 from jsonb_array_elements(p_quiz_answers) as answer
        where answer.value not in ('"A"'::jsonb, '"B"'::jsonb)
      )
    then
      raise exception 'quiz_invalid';
    end if;

    select array_agg(case when answer.value = '"A"'::jsonb then 1 else -1 end order by answer.ordinality)
    into v_scores
    from jsonb_array_elements(p_quiz_answers) with ordinality as answer;

    v_axes := jsonb_build_object(
      'explore', (v_scores[1] + v_scores[2]) / 2,
      'spicy', (v_scores[3] + v_scores[4]) / 2,
      'korean', (v_scores[5] + v_scores[6]) / 2,
      'lead', (v_scores[7] + v_scores[8]) / 2
    );
  end if;

  begin
    update public.profiles p set
      display_name = coalesce(v_name, p.display_name),
      handle = coalesce(p_handle, p.handle),
      quiz_answers = coalesce(p_quiz_answers, p.quiz_answers),
      axes = coalesce(v_axes, p.axes)
    where p.user_id = v_uid;

    if not found then
      if v_name is null then
        raise exception 'display_name_required';
      end if;
      insert into public.profiles (user_id, display_name, handle, quiz_answers, axes)
      values (v_uid, v_name, p_handle, p_quiz_answers, v_axes);
    end if;
  exception
    when unique_violation then
      raise exception 'handle_taken';
  end;

  return query
  select p.display_name, p.handle, p.axes
  from public.profiles p
  where p.user_id = v_uid;
end;
$$;

-- 내 기록 (4-15) ----------------------------------------------------------

create function public.my_food_counts()
returns table (food_id bigint, meal_count int)
language sql stable security definer set search_path = ''
as $$
  select ml.food_id, count(*)::int
  from public.meal_participants mp
  join public.meals ml on ml.id = mp.meal_id
  where mp.user_id = public.require_uid()
  group by ml.food_id
  order by 2 desc, 1
$$;

create function public.my_companions()
returns table (user_id uuid, display_name text, meal_count int)
language sql stable security definer set search_path = ''
as $$
  select other.user_id, p.display_name, count(*)::int
  from public.meal_participants me
  join public.meal_participants other on other.meal_id = me.meal_id and other.user_id <> me.user_id
  join public.profiles p on p.user_id = other.user_id
  where me.user_id = public.require_uid()
  group by other.user_id, p.display_name
  order by 3 desc, 2, 1
$$;


-- 모임 프로필 카드 (4-16) --------------------------------------------------

-- 인원수만 돌려준다. 사람이 적으면 숫자만으로 누구인지 드러나므로 3명 미만은 null이다
create function public.group_profile_card(p_group_id uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_min_people constant int := 3;
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

  if v_tested_count >= v_min_people then
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


-- 결과 카드 (4-17) ---------------------------------------------------------

-- 그 모임 소속이면 그 식사에 없었어도 볼 수 있다. 몇 번째는 모두 이 식사까지만 센다
create function public.meal_card(p_meal_id uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_meal public.meals;
  v_group_name text;
  v_group_food_nth int;
  v_my_food_nth int;
  v_people jsonb;
begin
  select * into v_meal from public.meals ml where ml.id = p_meal_id;
  if not found then
    raise exception 'meal_not_found';
  end if;
  if not public.is_group_member(v_meal.group_id) then
    raise exception 'not_member';
  end if;

  select g.name into v_group_name from public.groups g where g.id = v_meal.group_id;

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
    'people', coalesce(v_people, '[]'::jsonb)
  );
end;
$$;


-- profiles 권한 (5절). 온보딩 답과 축이 들어가므로 본인 행만 읽는다.
-- 쓰기는 save_my_profile과 resolve_display_name만 한다 ----------------------

revoke insert, update on public.profiles from authenticated;

drop policy profiles_insert on public.profiles;
drop policy profiles_update on public.profiles;
drop policy profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (user_id = (select auth.uid()));

-- 권한: 새 함수는 기본으로 열려 있어서 거둔 뒤 로그인한 사람에게만 연다 -----

revoke execute on function
  public.save_my_profile(text, text, jsonb),
  public.my_food_counts(),
  public.my_companions(),
  public.group_profile_card(uuid),
  public.meal_card(uuid)
  from public, anon;

grant execute on function
  public.save_my_profile(text, text, jsonb),
  public.my_food_counts(),
  public.my_companions(),
  public.group_profile_card(uuid),
  public.meal_card(uuid)
  to authenticated;
