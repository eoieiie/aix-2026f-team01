import { HANDLE_MAX, HANDLE_MIN } from '@/constants';
import { AXES, type AxisKey, type QuizAnswer } from '@/constants/quiz';

import type { Client } from './groups';
import { getSupabase } from './supabase';

// 내 프로필 (spec.md 4-14, 4-15). 쓰기는 save_my_profile로만 한다 (5절 2단계 표)

export type Axes = Record<AxisKey, number>;

export interface MyProfile {
  displayName: string;
  handle: string | null;
  axes: Axes | null;
  quizAnswers: QuizAnswer[] | null;
}

// 네 글자. 축 값이 0 이상이면 앞 글자(탐, 매, 한, 주), 음수면 뒤 글자(반, 순, 외, 수) (5절 "축 점수")
export function typeCode(axes: Partial<Axes> | null | undefined): string | null {
  if (!axes) return null;
  if (AXES.some((a) => typeof axes[a.key] !== 'number')) return null;
  return AXES.map((a) => ((axes[a.key] as number) >= 0 ? a.front : a.back)).join('');
}

// 축마다 한 줄 설명 ("새 메뉴 먼저")
export function typeLines(axes: Axes): { letter: string; line: string }[] {
  return AXES.map((a) =>
    axes[a.key] >= 0 ? { letter: a.front, line: a.frontLine } : { letter: a.back, line: a.backLine }
  );
}

export const PROFILE_ERROR_MESSAGES: Record<string, string> = {
  name_empty: '이름을 적어 주세요',
  name_too_long: '이름은 20자까지예요',
  display_name_required: '이름을 먼저 적어 주세요',
  handle_invalid: '영어 소문자, 숫자, 밑줄로 3~16자',
  handle_taken: '이미 쓰는 아이디예요',
  quiz_invalid: '답을 다시 골라 주세요',
};

export class ProfileError extends Error {
  constructor(public readonly code: string) {
    super(PROFILE_ERROR_MESSAGES[code] ?? code);
    this.name = 'ProfileError';
  }
}

// 화면 문구. 서버 코드가 아니면(연결 끊김 등) "연결할 수 없어요". 영어 원문은 보이지 않는다
export function profileErrorMessage(error: unknown): string {
  if (error instanceof ProfileError) return error.message;
  return '연결할 수 없어요';
}

const HANDLE_PATTERN = new RegExp(`^[a-z0-9_]{${HANDLE_MIN},${HANDLE_MAX}}$`);

// 서버에 묻기 전에 앱에서 먼저 거른다
export function isValidHandle(handle: string) {
  return HANDLE_PATTERN.test(handle);
}

export async function getMyProfile(client: Client = getSupabase()): Promise<MyProfile | null> {
  const session = await client.auth.getSession();
  if (session.error) throw session.error;
  const userId = session.data.session?.user?.id;
  if (!userId) return null;
  const { data, error } = await client
    .from('profiles')
    .select('display_name, handle, axes, quiz_answers')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    displayName: data.display_name,
    handle: data.handle ?? null,
    axes: (data.axes as Axes | null) ?? null,
    quizAnswers: (data.quiz_answers as QuizAnswer[] | null) ?? null,
  };
}

export interface SaveProfileInput {
  displayName?: string;
  handle?: string;
  quizAnswers?: QuizAnswer[];
}

// 넘긴 칸만 바꾼다. 프로필이 없으면 이름으로 만든다 (save_my_profile)
export async function saveMyProfile(
  input: SaveProfileInput,
  client: Client = getSupabase()
): Promise<{ displayName: string; handle: string | null; axes: Axes | null }> {
  const { data, error } = await client.rpc('save_my_profile', {
    p_display_name: input.displayName ?? null,
    p_handle: input.handle ?? null,
    p_quiz_answers: input.quizAnswers ?? null,
  });
  if (error) {
    if (error.message in PROFILE_ERROR_MESSAGES) throw new ProfileError(error.message);
    throw error;
  }
  const row = Array.isArray(data) ? data[0] : data;
  return {
    displayName: row?.display_name ?? '',
    handle: row?.handle ?? null,
    axes: row?.axes ?? null,
  };
}
