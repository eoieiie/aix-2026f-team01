import { getSupabase } from './supabase';
import type { Client } from './groups';

// 결과 카드 (spec.md 4-17). 숫자는 서버 함수 meal_card 하나로 받는다. 못 먹는 것은 받지도 보이지도 않는다

export interface MealPerson {
  userId: string;
  displayName: string;
  // 나와 이 사람이 같이 먹은 식사 수(이 식사까지). 나 자신은 null
  togetherNth: number | null;
}

export interface MealCard {
  groupName: string;
  eatenAt: string;
  foodId: number;
  foodName: string;
  groupFoodNth: number;
  // 내가 이 식사에 없었으면 null
  myFoodNth: number | null;
  people: MealPerson[];
  // 이번 달 이 모임이 같은 종류를 먹은 수 (0013). 서버에 아직 없거나 종류가 없으면 null
  monthCuisine: { cuisine: string; count: number } | null;
}

export const MEAL_ERROR_MESSAGES: Record<string, string> = {
  meal_not_found: '기록을 찾을 수 없어요',
  not_member: '이 모임 멤버가 아니에요',
  not_signed_in: '로그인이 필요해요',
};

export class MealError extends Error {
  constructor(public readonly code: string) {
    super(MEAL_ERROR_MESSAGES[code] ?? code);
    this.name = 'MealError';
  }
}

export function mealErrorMessage(error: unknown): string {
  if (error instanceof MealError) return error.message;
  return '연결할 수 없어요';
}

export async function getMealCard(mealId: string, client: Client = getSupabase()): Promise<MealCard> {
  const { data, error } = await client.rpc('meal_card', { p_meal_id: mealId });
  if (error) {
    if (error.message in MEAL_ERROR_MESSAGES) throw new MealError(error.message);
    // uuid 모양이 아니면 Postgres가 형식 오류를 낸다. 없는 기록과 같게 다룬다
    if ((error as { code?: string }).code === '22P02') throw new MealError('meal_not_found');
    throw error;
  }
  const d = data as any;
  let foodName: string = d.food_name ?? '';
  // 0013 전 서버에는 음식 이름 칸이 없다. 그때는 음식 표에서 읽는다
  if (!foodName) {
    const res = await client.from('foods').select('name').eq('id', d.food_id).maybeSingle();
    foodName = (res.data as { name?: string } | null)?.name ?? '';
  }
  const month = d.group_month_cuisine;
  return {
    groupName: d.group_name ?? '',
    eatenAt: d.eaten_at,
    foodId: d.food_id,
    foodName,
    groupFoodNth: d.group_food_nth ?? 1,
    myFoodNth: d.my_food_nth ?? null,
    people: (d.people ?? []).map((p: any) => ({
      userId: p.user_id,
      displayName: p.display_name ?? '',
      togetherNth: p.together_nth ?? null,
    })),
    monthCuisine:
      month && typeof month.count === 'number' && month.cuisine ? { cuisine: month.cuisine, count: month.count } : null,
  };
}

// 끝난 판의 식사 기록 id. 모임 소속이면 meals를 읽을 수 있다(0002). 아직 없으면 null
export async function getMealIdForSession(
  sessionId: string,
  client: Client = getSupabase()
): Promise<string | null> {
  const { data, error } = await client.from('meals').select('id').eq('session_id', sessionId).maybeSingle();
  if (error) throw error;
  return (data as { id?: string } | null)?.id ?? null;
}

// ---- 화면 문구 (순수 함수, jest) ----

// 마지막 글자에 받침이 있는지. 한글이 아니면 없는 것으로 본다
export function hasBatchim(word: string): boolean {
  const last = Array.from(word.trim()).pop();
  if (!last) return false;
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}

// "민지랑", "서연이랑"
export function withRang(name: string): string {
  return `${name}${hasBatchim(name) ? '이랑' : '랑'}`;
}

// 한국 시간 날짜 "11월 3일"
export function mealDateLabel(iso: string): string {
  const k = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
  return `${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일`;
}

const CUISINE_LABELS: Record<string, string> = {
  korean: '한식',
  chinese: '중식',
  japanese: '일식',
  western: '양식',
  asian: '아시안',
};

// "이번 달 이 모임은 한식 3번". 모르는 종류거나 없으면 null
export function monthCuisineLine(month: MealCard['monthCuisine']): string | null {
  if (!month) return null;
  const label = CUISINE_LABELS[month.cuisine];
  if (!label) return null;
  return `이번 달 이 모임은 ${label} ${month.count}번`;
}

// 같이 먹은 사람 줄. 첫 사람은 "민지랑 5번째 밥", 나머지는 한 줄에 "준호랑 2번째, 서연이랑은 처음".
// 내가 그 식사에 없었으면(myFoodNth null) 같이 먹은 수를 말하지 않는다. 넘치면 "외 N명"
export function togetherLines(card: Pick<MealCard, 'people' | 'myFoodNth'>, max = 3): string[] {
  if (card.myFoodNth === null) return [];
  const others = card.people.filter((p) => p.togetherNth !== null && p.togetherNth > 0);
  if (others.length === 0) return [];
  const shown = others.slice(0, max);
  const rest = others.length - shown.length;
  const phrase = (p: MealPerson, first: boolean) =>
    p.togetherNth === 1
      ? `${withRang(p.displayName)}은 처음`
      : `${withRang(p.displayName)} ${p.togetherNth}번째${first ? ' 밥' : ''}`;
  const lines = [phrase(shown[0], true)];
  const tail = shown.slice(1).map((p) => phrase(p, false));
  if (rest > 0) tail.push(`외 ${rest}명`);
  if (tail.length > 0) lines.push(tail.join(', '));
  return lines;
}

// 공유 글. 카드에 보이는 것만 넣고 못 먹는 것은 넣지 않는다. 링크는 앱 첫 화면 (카드 주소는 모임 사람만 열린다)
export function mealShareText(card: MealCard, webBase: string): string {
  const lines = [
    `${card.groupName}, ${mealDateLabel(card.eatenAt)}`,
    `오늘은 ${card.foodName}`,
    `우리 모임 ${card.groupFoodNth}번째 ${card.foodName}`,
    ...togetherLines(card),
  ];
  const month = monthCuisineLine(card.monthCuisine);
  if (month) lines.push(month);
  if (card.myFoodNth !== null) lines.push(`나의 ${card.myFoodNth}번째 ${card.foodName}`);
  lines.push('', `밥비티아이로 정했어요 ${webBase}`);
  return lines.join('\n');
}
