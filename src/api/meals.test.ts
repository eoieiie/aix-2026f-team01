import {
  getMealCard,
  hasBatchim,
  mealDateLabel,
  mealShareText,
  monthCuisineLine,
  togetherLines,
  withRang,
  type MealCard,
} from './meals';

const card: MealCard = {
  groupName: '공대 점심팟',
  eatenAt: '2026-11-02T15:30:00Z', // 한국 시간 11/3 00:30
  foodId: 7,
  foodName: '비빔밥',
  groupFoodNth: 3,
  myFoodNth: 2,
  people: [
    { userId: 'a', displayName: '민지', togetherNth: 5 },
    { userId: 'b', displayName: '준호', togetherNth: 2 },
    { userId: 'c', displayName: '서연', togetherNth: 1 },
    { userId: 'me', displayName: '병주', togetherNth: null },
  ],
  monthCuisine: { cuisine: 'korean', count: 4 },
};

describe('결과 카드 문구 (4-17)', () => {
  it('받침에 따라 랑, 이랑', () => {
    expect(hasBatchim('서연')).toBe(true);
    expect(hasBatchim('민지')).toBe(false);
    expect(hasBatchim('Amy')).toBe(false);
    expect(withRang('민지')).toBe('민지랑');
    expect(withRang('서연')).toBe('서연이랑');
  });

  it('날짜는 한국 시간', () => {
    expect(mealDateLabel(card.eatenAt)).toBe('11월 3일');
  });

  it('같이 먹은 사람: 첫 줄은 "OO랑 N번째 밥", 나머지는 한 줄, 처음이면 "은 처음"', () => {
    expect(togetherLines(card)).toEqual(['민지랑 5번째 밥', '준호랑 2번째, 서연이랑은 처음']);
  });

  it('넘치면 외 N명, 내가 없던 식사면 줄이 없다, 0번은 빼고', () => {
    expect(togetherLines(card, 1)).toEqual(['민지랑 5번째 밥', '외 2명']);
    expect(togetherLines({ ...card, myFoodNth: null })).toEqual([]);
    expect(
      togetherLines({ people: [{ userId: 'x', displayName: '혼자', togetherNth: 0 }], myFoodNth: 1 })
    ).toEqual([]);
  });

  it('이번 달 종류: 한국어로, 없거나 모르는 종류면 null', () => {
    expect(monthCuisineLine(card.monthCuisine)).toBe('이번 달 이 모임은 한식 4번');
    expect(monthCuisineLine(null)).toBeNull();
    expect(monthCuisineLine({ cuisine: 'mars', count: 1 })).toBeNull();
  });

  it('공유 글에는 카드 내용과 링크만 있고 못 먹는 것은 없다', () => {
    const text = mealShareText(card, 'https://babti.expo.app');
    expect(text).toContain('우리 모임 3번째 비빔밥');
    expect(text).toContain('민지랑 5번째 밥');
    expect(text).toContain('나의 2번째 비빔밥');
    expect(text).toContain('https://babti.expo.app');
    expect(text).not.toContain('못 먹');
  });
});

describe('getMealCard', () => {
  const fake = (rpc: { data?: unknown; error?: unknown }, foodName = '김밥') =>
    ({
      rpc: jest.fn(async () => rpc),
      from: jest.fn(() => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { name: foodName }, error: null }) }) }),
      })),
    }) as any;

  it('서버 칸을 화면 모양으로 바꾸고, 음식 이름이 없으면 음식 표에서 읽는다', async () => {
    const res = await getMealCard(
      'm1',
      fake({
        data: {
          group_name: '팟',
          eaten_at: '2026-11-03T03:00:00Z',
          food_id: 3,
          group_food_nth: 1,
          my_food_nth: null,
          people: [{ user_id: 'u', display_name: '하나', together_nth: null }],
        },
        error: null,
      })
    );
    expect(res.foodName).toBe('김밥');
    expect(res.monthCuisine).toBeNull();
    expect(res.people[0].displayName).toBe('하나');
  });

  it('없는 기록과 소속 아님은 한국어 문구', async () => {
    await expect(getMealCard('m1', fake({ data: null, error: { message: 'meal_not_found' } }))).rejects.toThrow(
      '기록을 찾을 수 없어요'
    );
    await expect(getMealCard('m1', fake({ data: null, error: { message: 'not_member' } }))).rejects.toThrow(
      '이 모임 멤버가 아니에요'
    );
  });
});
