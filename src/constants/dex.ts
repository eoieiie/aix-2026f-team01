// 음식 도감과 식사 타임라인의 규칙 (명세 4-25). 서버를 부르지 않는 계산만 둔다

export interface DexFood {
  foodId: number;
  name: string;
  imageUrl: string | null;
  custom: boolean;
  mealCount: number;
  firstEaten: string | null;
  lastEaten: string | null;
  companionCount: number;
}

export interface TimelineMeal {
  mealId: string;
  foodId: number;
  foodName: string;
  cuisine: string | null;
  imageUrl: string | null;
  eatenAt: string;
  eaters: string[];
}

// "모음"은 기본 메뉴를 한 번 이상 먹은 것. 직접 적은 메뉴는 모음 수에 넣지 않는다(사람마다 목록이 달라 진행 막대가 흔들린다)
export function dexProgress(foods: DexFood[]): { collected: number; total: number } {
  const base = foods.filter((f) => !f.custom);
  return { collected: base.filter((f) => f.mealCount > 0).length, total: base.length };
}

// 기념 숫자: 처음 먹은 메뉴(1번째)와 같은 메뉴 10, 20, 30, 50, 100번째. 그 밖에는 아무것도 보이지 않는다
export const MILESTONE_COUNTS = [10, 20, 30, 50, 100];
export function milestoneLabel(foodName: string, myCount: number): string | null {
  if (myCount === 1) return '새 메뉴 모음!';
  if (MILESTONE_COUNTS.includes(myCount)) return `${myCount}번째 ${foodName}`;
  return null;
}

// 한국 시간 기준 "2026년 11월"
export function monthKey(iso: string): string {
  const k = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
  return `${k.getUTCFullYear()}년 ${k.getUTCMonth() + 1}월`;
}
export function dayLabel(iso: string): string {
  const k = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
  return `${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일`;
}

export function groupByMonth(meals: TimelineMeal[]): { month: string; meals: TimelineMeal[] }[] {
  const out: { month: string; meals: TimelineMeal[] }[] = [];
  for (const m of meals) {
    const key = monthKey(m.eatenAt);
    const last = out[out.length - 1];
    if (last && last.month === key) last.meals.push(m);
    else out.push({ month: key, meals: [m] });
  }
  return out;
}

const CUISINE_LABELS: Record<string, string> = {
  korean: '한식',
  chinese: '중식',
  japanese: '일식',
  western: '양식',
  asian: '아시안',
};

// 이번 달(한국 시간) 모임 통계 한 줄: "이번 달 7번, 한식 4번". 이번 달 식사가 없으면 null.
// 가장 많은 종류가 둘 이상 같으면 종류는 빼고 횟수만
export function monthStatLine(meals: TimelineMeal[], now: Date = new Date()): string | null {
  const key = monthKey(now.toISOString());
  const month = meals.filter((m) => monthKey(m.eatenAt) === key);
  if (month.length === 0) return null;
  const counts = new Map<string, number>();
  for (const m of month) if (m.cuisine && CUISINE_LABELS[m.cuisine]) counts.set(m.cuisine, (counts.get(m.cuisine) ?? 0) + 1);
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0 || (sorted.length > 1 && sorted[0][1] === sorted[1][1])) return `이번 달 ${month.length}번`;
  return `이번 달 ${month.length}번, ${CUISINE_LABELS[sorted[0][0]]} ${sorted[0][1]}번`;
}
