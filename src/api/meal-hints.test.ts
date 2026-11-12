import { daysAgoKST, eatenNote, groupFavorites, quickFillPicks, type FoodHint } from './sessions';

// 4-20 식사 기록을 판에 다시 쓰기
const now = new Date('2026-11-12T03:00:00Z'); // 한국 시간 11/12 12:00

describe('eatenNote', () => {
  it('한국 시간 날짜로 센다. 오늘, 어제, N일 전', () => {
    expect(eatenNote('2026-11-12T00:30:00Z', 14, now)).toBe('오늘 먹었어요');
    // 한국 시간 11/11 23:30 = 어제
    expect(eatenNote('2026-11-11T14:30:00Z', 14, now)).toBe('어제 먹었어요');
    expect(eatenNote('2026-11-02T03:00:00Z', 14, now)).toBe('10일 전에 먹었어요');
  });
  it('14일까지만 보이고 15일 전이면 없다', () => {
    expect(eatenNote('2026-10-29T03:00:00Z', 14, now)).toBe('14일 전에 먹었어요');
    expect(eatenNote('2026-10-28T03:00:00Z', 14, now)).toBeNull();
    expect(eatenNote(null, 14, now)).toBeNull();
  });
  it('daysAgoKST는 한국 자정을 기준으로 바뀐다', () => {
    expect(daysAgoKST('2026-11-11T15:00:00Z', now)).toBe(0); // 한국 11/12 00:00
  });
});

const h = (foodId: number, eatenCount: number, lastEatenAt: string | null, blocked = false): FoodHint => ({
  foodId,
  eatenCount,
  lastEatenAt,
  blocked,
});

describe('groupFavorites', () => {
  it('많이 먹은 순, 같으면 최근 순. 이미 후보이거나 못 먹는 사람이 있으면 뺀다', () => {
    const hints = [
      h(1, 2, '2026-11-01T00:00:00Z'),
      h(2, 2, '2026-11-10T00:00:00Z'),
      h(3, 5, '2026-10-01T00:00:00Z', true),
      h(4, 1, '2026-11-11T00:00:00Z'),
      h(5, 3, '2026-11-05T00:00:00Z'),
      h(6, 0, null),
    ];
    expect(groupFavorites(hints, [5], 3).map((x) => x.foodId)).toEqual([2, 1, 4]);
  });
});

describe('quickFillPicks', () => {
  it('못 먹는 사람이 있는 음식과 이미 올린 후보는 고르지 않는다', () => {
    const hints = [h(1, 0, null, true), h(2, 0, null), h(3, 0, null), h(4, 0, null)];
    const picks = quickFillPicks(hints, [4], 3, 14, () => 0, now);
    expect(picks.sort()).toEqual([2, 3]);
  });
  it('최근 14일 안에 먹은 음식은 뒤로 미룬다', () => {
    const hints = [h(1, 1, '2026-11-11T03:00:00Z'), h(2, 0, null), h(3, 1, '2026-10-01T03:00:00Z')];
    const picks = quickFillPicks(hints, [], 2, 14, () => 0.5, now);
    expect(picks.sort()).toEqual([2, 3]);
  });
});
