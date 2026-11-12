import { authorityTitle, levelOf, typeLetters } from './stats';

describe('levelOf (4-15 삼각수 레벨)', () => {
  it.each([
    [0, 0, 1],
    [1, 1, 2],
    [2, 1, 1],
    [3, 2, 3],
    [5, 2, 1],
    [6, 3, 4],
    [10, 4, 5],
  ])('%i끼면 레벨 %i, 다음 레벨까지 %i끼', (meals, level, toNext) => {
    expect(levelOf(meals)).toEqual({ level, toNext });
  });
});

describe('authorityTitle', () => {
  it('3번 이상 먹은 것 중 가장 많은 것, 같으면 food_id가 작은 것', () => {
    expect(
      authorityTitle([
        { foodId: 5, name: '라멘', mealCount: 3 },
        { foodId: 2, name: '김밥', mealCount: 3 },
        { foodId: 9, name: '국밥', mealCount: 2 },
      ])
    ).toBe('김밥 권위자');
  });
  it('3번 미만이면 없다', () => {
    expect(authorityTitle([{ foodId: 1, name: '김밥', mealCount: 2 }])).toBeNull();
  });
});

describe('typeLetters', () => {
  it('0 이상이면 앞 글자, 음수면 뒤 글자', () => {
    expect(typeLetters({ explore: 1, spicy: 0, korean: -1, lead: 1 })).toEqual(['탐', '매', '외', '주']);
    expect(typeLetters({ explore: -1, spicy: -1, korean: -1, lead: -1 })).toEqual(['반', '순', '외', '수']);
  });
});
