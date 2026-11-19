import { getSessionRestaurants, kakaoMapUrl, type NearbyRestaurant, pickForMe, restaurantInfo } from './restaurants';

// PR #78 본문의 돌려주는 값 표 모양으로 만든 가짜 식당. 실제 가게가 아니다
function fake(over: Partial<NearbyRestaurant> & { id: number }): NearbyRestaurant {
  return {
    name: `식당${over.id}`,
    cuisine: 'korean',
    partner: false,
    couponText: null,
    match: 'cuisine',
    myCode: null,
    lat: null,
    lng: null,
    foodId: null,
    walkMinutes: null,
    openNow: null,
    teamCount: 0,
    photoUrl: null,
    ...over,
  };
}

const noTaste = { axes: null, eatenFoodIds: new Set<number>() };

describe('restaurantInfo (4-21)', () => {
  it('걸어서 N분 · 영업 중 · 밥BTI로 간 모임 N팀 중 값이 있는 것만', () => {
    expect(restaurantInfo({ walkMinutes: 5, openNow: true, teamCount: 2, cuisine: 'korean' })).toBe(
      '걸어서 5분 · 영업 중 · 밥BTI로 간 모임 2팀'
    );
    expect(restaurantInfo({ walkMinutes: 3, openNow: null, teamCount: 0, cuisine: 'korean' })).toBe('걸어서 3분');
  });

  it('닫았으면 "지금 닫음", 영업시간을 모르면 아무것도 없다', () => {
    expect(restaurantInfo({ walkMinutes: 4, openNow: false, teamCount: 0, cuisine: null })).toBe('걸어서 4분 · 지금 닫음');
  });

  it('세 값을 다 모르면 종류, 종류도 모르면 빈 줄', () => {
    expect(restaurantInfo({ walkMinutes: null, openNow: null, teamCount: 0, cuisine: 'chinese' })).toBe('중식');
    expect(restaurantInfo({ walkMinutes: null, openNow: null, teamCount: 0, cuisine: null })).toBe('');
  });
});

describe('pickForMe (4-21 투표 화면 추천 칸)', () => {
  it('네 글자가 없으면 서버 순서대로 3곳', () => {
    const list = [1, 2, 3, 4, 5, 6].map((id) => fake({ id }));
    expect(pickForMe(list, noTaste).map((r) => r.id)).toEqual([1, 2, 3]);
  });

  it('후보 음식을 파는 곳이 먼저', () => {
    const list = [fake({ id: 1 }), fake({ id: 2 }), fake({ id: 3, match: 'menu', foodId: 10 })];
    expect(pickForMe(list, noTaste, 2).map((r) => r.id)).toEqual([3, 1]);
  });

  it('외국음식 쪽이면 한식이 아닌 곳, 한식 쪽이면 한식', () => {
    const list = [fake({ id: 1, cuisine: 'korean' }), fake({ id: 2, cuisine: 'western' })];
    const outside = { axes: { explore: 0, spicy: 0, korean: -1, lead: 0 }, eatenFoodIds: new Set<number>() };
    const inside = { axes: { explore: 0, spicy: 0, korean: 1, lead: 0 }, eatenFoodIds: new Set<number>() };
    expect(pickForMe(list, outside, 1)[0].id).toBe(2);
    expect(pickForMe(list, inside, 1)[0].id).toBe(1);
  });

  it('탐험이면 안 먹어 본 음식, 반복이면 먹어 본 음식', () => {
    const list = [
      fake({ id: 1, match: 'menu', foodId: 10 }),
      fake({ id: 2, match: 'menu', foodId: 20 }),
    ];
    const eaten = new Set([10]);
    const explorer = { axes: { explore: 1, spicy: 0, korean: 0, lead: 0 }, eatenFoodIds: eaten };
    const repeater = { axes: { explore: -1, spicy: 0, korean: 0, lead: 0 }, eatenFoodIds: eaten };
    expect(pickForMe(list, explorer, 1)[0].id).toBe(2);
    expect(pickForMe(list, repeater, 1)[0].id).toBe(1);
  });

  it('지금 닫은 곳은 뒤로', () => {
    const list = [fake({ id: 1, match: 'menu', foodId: 10, openNow: false }), fake({ id: 2 })];
    expect(pickForMe(list, noTaste).map((r) => r.id)).toEqual([2, 1]);
  });

  it('제휴에는 점수를 더하지 않는다. 취향이 맞는 곳이 광고보다 앞', () => {
    const list = [fake({ id: 1, partner: true, cuisine: 'korean' }), fake({ id: 2, cuisine: 'western' })];
    const outside = { axes: { explore: 0, spicy: 0, korean: -1, lead: 0 }, eatenFoodIds: new Set<number>() };
    expect(pickForMe(list, outside).map((r) => r.id)).toEqual([2, 1]);
  });

  it('6곳보다 적으면 있는 만큼, 없으면 빈 목록', () => {
    expect(pickForMe([fake({ id: 1 })], noTaste)).toHaveLength(1);
    expect(pickForMe([], noTaste)).toEqual([]);
  });
});

describe('getSessionRestaurants', () => {
  it('서버 칸 이름을 앱 이름으로 바꾸고, 제휴가 아니면 쿠폰과 사진이 없다', async () => {
    const rpc = jest.fn(async () => ({
      data: [
        {
          id: 1,
          name: '한식당 제휴',
          cuisine: 'korean',
          partner: true,
          coupon_text: '음료 1개',
          match: 'cuisine',
          my_code: null,
          food_id: null,
          walk_minutes: 5,
          open_now: true,
          team_count: 2,
          photo_url: 'https://example.supabase.co/storage/v1/object/public/restaurant-photos/a.jpg',
        },
        {
          id: 2,
          name: '최고집 칼국수',
          cuisine: null,
          partner: false,
          coupon_text: null,
          match: 'menu',
          my_code: null,
          food_id: 7,
          walk_minutes: null,
          open_now: null,
          team_count: 0,
          photo_url: 'https://example.supabase.co/storage/v1/object/public/restaurant-photos/b.jpg',
        },
      ],
      error: null,
    }));
    const list = await getSessionRestaurants('s1', { rpc } as any);
    expect(rpc).toHaveBeenCalledWith('session_restaurants', { p_session_id: 's1' });
    expect(list[0]).toEqual({
      id: 1,
      name: '한식당 제휴',
      cuisine: 'korean',
      partner: true,
      couponText: '음료 1개',
      match: 'cuisine',
      myCode: null,
      lat: null,
      lng: null,
      foodId: null,
      walkMinutes: 5,
      openNow: true,
      teamCount: 2,
      photoUrl: 'https://example.supabase.co/storage/v1/object/public/restaurant-photos/a.jpg',
    });
    expect(list[1].partner).toBe(false);
    expect(list[1].couponText).toBeNull();
    expect(list[1].foodId).toBe(7);
    expect(list[1].photoUrl).toBeNull();
  });

  it('0016 전의 서버(새 칸 없음)는 모름으로 읽는다', async () => {
    const rpc = jest.fn(async () => ({
      data: [{ id: 3, name: '옛 식당', cuisine: 'korean', partner: false, coupon_text: null, match: 'menu', my_code: null }],
      error: null,
    }));
    const [r] = await getSessionRestaurants('s1', { rpc } as any);
    expect([r.foodId, r.walkMinutes, r.openNow, r.teamCount, r.photoUrl]).toEqual([null, null, null, 0, null]);
  });
});

describe('좌표와 카카오맵 주소', () => {
  it('서버 함수에 좌표가 없으면 식당 표에서 읽어 붙인다', async () => {
    const rpc = jest.fn(async () => ({
      data: [{ id: 7, name: '보배반점', cuisine: 'chinese', partner: false, coupon_text: null, match: 'menu', my_code: null }],
      error: null,
    }));
    const inFn = jest.fn(async () => ({ data: [{ id: 7, lat: 37.3, lng: 126.84 }], error: null }));
    const from = jest.fn(() => ({ select: () => ({ in: inFn }) }));
    const list = await getSessionRestaurants('s1', { rpc, from } as any);
    expect(from).toHaveBeenCalledWith('restaurants');
    expect(inFn).toHaveBeenCalledWith('id', [7]);
    expect(list[0].lat).toBe(37.3);
    expect(list[0].lng).toBe(126.84);
  });

  it('좌표가 있으면 그 자리, 없으면 이름으로 찾기', () => {
    expect(kakaoMapUrl({ name: '보배반점', lat: 37.3, lng: 126.84 })).toBe(
      `https://map.kakao.com/link/map/${encodeURIComponent('보배반점')},37.3,126.84`
    );
    expect(kakaoMapUrl({ name: '이모네', lat: null, lng: null })).toBe(
      `https://map.kakao.com/link/search/${encodeURIComponent('안산 이모네')}`
    );
  });
});
