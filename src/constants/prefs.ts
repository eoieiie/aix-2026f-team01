// 프로필 꾸미기와 취향 (명세 4-27). 고를 수 있는 값은 서버 0036(pref_cuisines, pref_colleges, pref_meal_times)과 같아야 한다.
// 전부 선택 항목이고, 안 골라도 앱은 그대로 쓸 수 있다

// 한양대 ERICA 단과대 10곳 (hanyang.ac.kr/erica, 2026-11-25 확인)
export const COLLEGES = [
  { key: 'eng', label: '공학대학' },
  { key: 'computing', label: '소프트웨어융합대학' },
  { key: 'pharmacy', label: '약학대학' },
  { key: 'atc', label: '첨단융합대학' },
  { key: 'gcc', label: '글로벌문화통상대학' },
  { key: 'cnc', label: '커뮤니케이션&컬처대학' },
  { key: 'cbe', label: '경상대학' },
  { key: 'design', label: '디자인대학' },
  { key: 'sports_arts', label: '예체능대학' },
  { key: 'lions', label: 'LIONS칼리지' },
] as const;

// foods.cuisine과 같은 값
export const CUISINES = [
  { key: 'korean', label: '한식' },
  { key: 'chinese', label: '중식' },
  { key: 'japanese', label: '일식' },
  { key: 'western', label: '양식' },
  { key: 'asian', label: '아시안' },
] as const;

// 매운맛 4단계 (0~3). 판에서는 가장 약한 사람에게 맞춘다
export const SPICE_LEVELS = [
  { value: 0, label: '안 맵게' },
  { value: 1, label: '조금' },
  { value: 2, label: '보통' },
  { value: 3, label: '맵게' },
] as const;

// 한 끼 예산 3단계 (1~3)
export const BUDGET_LEVELS = [
  { value: 1, label: '8천 원까지' },
  { value: 2, label: '1만 2천 원까지' },
  { value: 3, label: '상관없어요' },
] as const;

export const MEAL_TIMES = [
  { key: 'lunch', label: '점심' },
  { key: 'dinner', label: '저녁' },
] as const;

export type CollegeKey = (typeof COLLEGES)[number]['key'];
export type CuisineKey = (typeof CUISINES)[number]['key'];
export type MealTimeKey = (typeof MEAL_TIMES)[number]['key'];

// 처음부터 열려 있는 아바타 수. 서버 avatar_starter_count()와 같다
export const AVATAR_STARTER_COUNT = 6;

export interface MyPrefs {
  avatarFoodId: number | null;
  college: CollegeKey | null;
  favCuisines: CuisineKey[];
  spiceLevel: number | null;
  budgetLevel: number | null;
  mealTimes: MealTimeKey[];
}

export const EMPTY_PREFS: MyPrefs = {
  avatarFoodId: null,
  college: null,
  favCuisines: [],
  spiceLevel: null,
  budgetLevel: null,
  mealTimes: [],
};

export interface AvatarOption {
  foodId: number;
  name: string;
  imageUrl: string | null;
  // 0이면 처음부터 열려 있다. n이면 레벨 n에 열린다
  unlockLevel: number;
  eaten: boolean;
  unlocked: boolean;
}

export function collegeLabel(key: string | null | undefined): string | null {
  return COLLEGES.find((c) => c.key === key)?.label ?? null;
}

// 여러 개 고르는 칸: 있으면 빼고 없으면 넣는다. 순서는 목록 순서를 따른다
export function toggleIn<T extends string>(list: readonly T[], key: T, order: readonly T[]): T[] {
  const next = list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
  return order.filter((k) => next.includes(k));
}

// 다음에 열리는 아바타: 아직 안 열린 것 중 가장 낮은 레벨에 열리는 것. 다 열렸으면 null
export function nextAvatarUnlock(options: AvatarOption[]): AvatarOption | null {
  const locked = options.filter((o) => !o.unlocked).sort((a, b) => a.unlockLevel - b.unlockLevel || a.foodId - b.foodId);
  return locked[0] ?? null;
}

// 고르는 창의 순서: 열린 것 먼저(목록 순서), 그 뒤에 잠긴 것(열리는 레벨 순)
export function sortAvatarOptions(options: AvatarOption[]): AvatarOption[] {
  const open = options.filter((o) => o.unlocked);
  const locked = options.filter((o) => !o.unlocked).sort((a, b) => a.unlockLevel - b.unlockLevel || a.foodId - b.foodId);
  return [...open, ...locked];
}

// 바뀐 칸만 서버로 보낸다. 바뀐 것이 없으면 null
export function prefsPatch(before: MyPrefs, after: MyPrefs): Record<string, unknown> | null {
  const patch: Record<string, unknown> = {};
  const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x));
  if (before.avatarFoodId !== after.avatarFoodId) patch.avatar_food_id = after.avatarFoodId;
  if (before.college !== after.college) patch.college = after.college;
  if (!same(before.favCuisines, after.favCuisines)) patch.fav_cuisines = after.favCuisines;
  if (before.spiceLevel !== after.spiceLevel) patch.spice_level = after.spiceLevel;
  if (before.budgetLevel !== after.budgetLevel) patch.budget_level = after.budgetLevel;
  if (!same(before.mealTimes, after.mealTimes)) patch.meal_times = after.mealTimes;
  return Object.keys(patch).length > 0 ? patch : null;
}
