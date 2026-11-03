-- 명세 5절 서버 함수(2단계). 프로필 저장과 집계, profiles 권한 좁히기.

-- 아이디 길이와 문항 수 (4-14). src/constants/index.ts와 같아야 한다
create or replace function public.app_limits() returns jsonb
language sql immutable set search_path = ''
as $$
  select '{"GROUP_NAME_MAX": 40, "DISPLAY_NAME_MAX": 20, "INVITE_CODE_LENGTH": 6, "PITCH_MAX": 60, "MAX_VOTES_PER_PERSON": 2, "HANDLE_MIN": 3, "HANDLE_MAX": 16, "QUIZ_LENGTH": 8}'::jsonb
$$;
