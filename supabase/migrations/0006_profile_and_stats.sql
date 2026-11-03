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

-- 권한: 새 함수는 기본으로 열려 있어서 거둔 뒤 로그인한 사람에게만 연다 -----

revoke execute on function
  public.save_my_profile(text, text, jsonb)
  from public, anon;

grant execute on function
  public.save_my_profile(text, text, jsonb)
  to authenticated;
