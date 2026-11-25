import {
  type AvatarOption,
  COLLEGES,
  CUISINES,
  type CollegeKey,
  type CuisineKey,
  MEAL_TIMES,
  type MealTimeKey,
  type MyPrefs,
} from '@/constants/prefs';

import { foodImagePublicUrl } from './food-images';
import type { Client } from './groups';
import { getSupabase } from './supabase';

// 프로필 꾸미기와 취향 (0036, 명세 4-27). 읽기와 쓰기 모두 서버 함수로만 한다.
// 단과대와 취향은 본인에게만 온다. 다른 사람에게는 아바타 그림만 간다(getVisibleAvatars)

export const PREFS_ERROR_MESSAGES: Record<string, string> = {
  avatar_locked: '아직 열리지 않은 아바타예요',
  prefs_invalid: '다시 골라 주세요',
  display_name_required: '이름을 먼저 적어 주세요',
};

export class PrefsError extends Error {
  constructor(public readonly code: string) {
    super(PREFS_ERROR_MESSAGES[code] ?? code);
    this.name = 'PrefsError';
  }
}

// 화면 문구. 서버 코드가 아니면 "연결할 수 없어요". 영어 원문은 보이지 않는다
export function prefsErrorMessage(error: unknown): string {
  if (error instanceof PrefsError) return error.message;
  return '연결할 수 없어요';
}

function imageUrl(path: string | null | undefined): string | null {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  return base ? foodImagePublicUrl(base, path) : null;
}

const COLLEGE_KEYS = COLLEGES.map((c) => c.key) as readonly string[];
const CUISINE_KEYS = CUISINES.map((c) => c.key) as readonly string[];
const MEAL_TIME_KEYS = MEAL_TIMES.map((c) => c.key) as readonly string[];

// 서버가 준 값을 화면 타입으로. 모르는 값은 버린다(서버 목록이 먼저 바뀌어도 화면이 깨지지 않게)
export function toMyPrefs(row: any): MyPrefs {
  const level = (v: unknown, min: number, max: number) =>
    typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null;
  const list = (v: unknown, keys: readonly string[]) =>
    Array.isArray(v) ? keys.filter((k) => (v as unknown[]).includes(k)) : [];
  return {
    avatarFoodId: typeof row?.avatar_food_id === 'number' ? row.avatar_food_id : null,
    college: COLLEGE_KEYS.includes(row?.college) ? (row.college as CollegeKey) : null,
    favCuisines: list(row?.fav_cuisines, CUISINE_KEYS) as CuisineKey[],
    spiceLevel: level(row?.spice_level, 0, 3),
    budgetLevel: level(row?.budget_level, 1, 3),
    mealTimes: list(row?.meal_times, MEAL_TIME_KEYS) as MealTimeKey[],
  };
}

// 프로필이 없으면(이름도 안 적은 새 사람) null
export async function getMyPrefs(client: Client = getSupabase()): Promise<MyPrefs | null> {
  const { data, error } = await client.rpc('my_prefs');
  if (error) throw error;
  return data ? toMyPrefs(data) : null;
}

// 바뀐 칸만 넘긴다(prefsPatch). 서버가 값을 다시 확인하고 저장된 값을 돌려준다
export async function saveMyPrefs(patch: Record<string, unknown>, client: Client = getSupabase()): Promise<MyPrefs> {
  const { data, error } = await client.rpc('save_my_prefs', { p_prefs: patch });
  if (error) {
    if (error.message in PREFS_ERROR_MESSAGES) throw new PrefsError(error.message);
    throw error;
  }
  return toMyPrefs(data);
}

export async function getAvatarOptions(client: Client = getSupabase()): Promise<AvatarOption[]> {
  const { data, error } = await client.rpc('my_avatar_options');
  if (error) throw error;
  return ((data ?? []) as any[]).map((r) => ({
    foodId: r.food_id,
    name: r.name ?? '',
    imageUrl: imageUrl(r.image_path),
    unlockLevel: r.unlock_level ?? 0,
    eaten: !!r.eaten,
    unlocked: !!r.unlocked,
  }));
}

// 내가 볼 수 있는 사람(나, 같은 모임, 같이 먹은 사람)의 아바타. 사람 id → 음식 id.
// 못 받으면 빈 표이고 화면은 이름 첫 글자로 그린다
export async function getVisibleAvatars(client: Client = getSupabase()): Promise<Record<string, number>> {
  try {
    const { data, error } = await client.rpc('visible_avatars');
    if (error) return {};
    const out: Record<string, number> = {};
    for (const r of (data ?? []) as any[]) {
      if (typeof r.user_id === 'string' && typeof r.food_id === 'number') out[r.user_id] = r.food_id;
    }
    return out;
  } catch {
    return {};
  }
}
