import { getSessionRestaurants, kakaoMapUrl, restaurantLine } from './restaurants';

describe('restaurantLine (4-21)', () => {
  it('메뉴가 맞으면 "OO 있어요", 아니면 종류', () => {
    expect(restaurantLine({ match: 'menu', cuisine: 'korean' }, '칼국수')).toBe('칼국수 있어요');
    expect(restaurantLine({ match: 'cuisine', cuisine: 'chinese' }, '짜장면')).toBe('중식');
    expect(restaurantLine({ match: 'cuisine', cuisine: null }, '짜장면')).toBe('');
  });
});

describe('getSessionRestaurants', () => {
  it('서버 칸 이름을 앱 이름으로 바꾸고, 제휴가 아니면 쿠폰이 없다', async () => {
    const rpc = jest.fn(async () => ({
      data: [
        { id: 1, name: '한식당 제휴', cuisine: 'korean', partner: true, coupon_text: '음료 1개', match: 'cuisine', my_code: null },
        { id: 2, name: '최고집 칼국수', cuisine: null, partner: false, coupon_text: null, match: 'menu', my_code: null },
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
    });
    expect(list[1].partner).toBe(false);
    expect(list[1].couponText).toBeNull();
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
