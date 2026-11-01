import { finalRotation, rouletteLabel, sliceArcs, sliceAt } from './roulette';

describe('룰렛 원판 (spec.md 4-12)', () => {
  const slices = [
    { foodId: 1, name: '김치찌개', weight: 3 },
    { foodId: 4, name: '마라탕', weight: 1 },
  ];

  it('조각 크기는 표 수에 비례한다. 3표는 1표의 3배', () => {
    const arcs = sliceArcs(slices);
    expect(arcs.map((a) => a.end - a.start)).toEqual([270, 90]);
  });

  it('어느 결과든 멈춘 뒤 바늘 아래 조각이 서버가 정한 음식이다', () => {
    const arcs = sliceArcs([...slices, { foodId: 9, name: '쌀국수', weight: 2 }]);
    for (const a of arcs) {
      const r = finalRotation(arcs, a.foodId);
      expect(arcs[sliceAt(arcs, r)].foodId).toBe(a.foodId);
    }
  });

  it('멈추기 전에 5바퀴 이상 돈다', () => {
    const arcs = sliceArcs(slices);
    expect(finalRotation(arcs, 4)).toBeGreaterThanOrEqual(360 * 5);
  });

  it('음식 이름이 7글자를 넘으면 자른다', () => {
    expect(rouletteLabel('김치찌개')).toBe('김치찌개');
    expect(rouletteLabel('차돌된장찌개정식세트')).toBe('차돌된장찌개정…');
  });
});
