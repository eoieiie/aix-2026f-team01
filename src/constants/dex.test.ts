import { dexProgress, groupByMonth, milestoneLabel, monthStatLine, type DexFood, type TimelineMeal } from './dex';

const food = (id: number, count: number, custom = false): DexFood => ({
  foodId: id, name: `f${id}`, imageUrl: null, custom, mealCount: count, firstEaten: null, lastEaten: null, companionCount: 0,
});
const meal = (id: string, at: string, cuisine: string | null): TimelineMeal => ({
  mealId: id, foodId: 1, foodName: 'x', cuisine, imageUrl: null, eatenAt: at, eaters: [],
});

describe('도감 (4-25)', () => {
  it('직접 적은 메뉴는 모음 수와 전체 수에 넣지 않는다', () => {
    expect(dexProgress([food(1, 2), food(2, 0), food(3, 1, true)])).toEqual({ collected: 1, total: 2 });
  });
  it('기념 숫자: 처음, 10/20/30/50/100번째만', () => {
    expect(milestoneLabel('짜장면', 1)).toBe('새 메뉴 모음!');
    expect(milestoneLabel('짜장면', 10)).toBe('10번째 짜장면');
    expect(milestoneLabel('짜장면', 2)).toBeNull();
    expect(milestoneLabel('짜장면', 11)).toBeNull();
  });
});

describe('타임라인 (4-25)', () => {
  it('한국 시간 기준 월로 묶는다', () => {
    const g = groupByMonth([meal('a', '2026-11-30T16:00:00Z', null), meal('b', '2026-11-30T14:00:00Z', null)]);
    expect(g.map((x) => x.month)).toEqual(['2026년 12월', '2026년 11월']);
  });
  it('이번 달 통계 한 줄, 가장 많은 종류가 같으면 횟수만', () => {
    const now = new Date('2026-11-20T03:00:00Z');
    const ms = [meal('a', '2026-11-19T03:00:00Z', 'korean'), meal('b', '2026-11-18T03:00:00Z', 'korean'), meal('c', '2026-11-17T03:00:00Z', 'chinese')];
    expect(monthStatLine(ms, now)).toBe('이번 달 3번, 한식 2번');
    expect(monthStatLine(ms.slice(1), now)).toBe('이번 달 2번');
    expect(monthStatLine([meal('d', '2026-10-01T03:00:00Z', 'korean')], now)).toBeNull();
  });
});
