import { getSessionRestaurants, restaurantLine } from './restaurants';

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
    });
    expect(list[1].partner).toBe(false);
    expect(list[1].couponText).toBeNull();
  });
});
