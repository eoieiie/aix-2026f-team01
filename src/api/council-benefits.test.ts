import { benefitLine, councilMapLinks, councilShopRows, type CouncilBenefit } from './council-benefits';
import type { Shop } from './shops';

const entry = (id: number, name: string, restaurant: number | null): CouncilBenefit => ({
  id, shop_name: name, restaurant_id: restaurant, college: 'computing', council_name: 'LINK',
  benefit: '음료 한 잔', period: null, conditions: null, location: null,
  status: 'notice', source_url: 'https://example.com', checked_on: '2026-11-25',
});
const shop = (id: number, cuisine: string, lat: number): Shop => ({
  id, name: '가게', cuisine, lat, lng: 126.8369, partner: false, couponText: null,
  walkMinutes: null, openNow: null, photoUrl: null, thumbUrl: null, menus: ['커피'], menusGuess: [],
});
const rows = [entry(1, '미연결 식당', null), entry(2, '먼 식당', 2), entry(3, '가까운 카페', 3)];
const shops = [shop(2, 'korean', 37.31), shop(3, 'cafe', 37.3)];

it('가까운 가게부터, 연결하지 못한 가게는 뒤에 둔다', () => {
  expect(councilShopRows(rows, shops, 'all', '').map(({ entry: row }) => row.id)).toEqual([3, 2, 1]);
});
it('제휴와 종류를 함께 거르고, 미연결은 전체에서만 보인다', () => {
  expect(councilShopRows(rows, shops, 'cafe', '커피').map(({ entry: row }) => row.id)).toEqual([3]);
  expect(councilShopRows(rows, shops, 'korean', '미연결')).toEqual([]);
});
it('지도 검색에는 가게 이름과 지역을 안전하게 넣는다', () => {
  expect(councilMapLinks('가게 & 카페', null)).toEqual({
    naver: `https://map.naver.com/p/search/${encodeURIComponent('안산 가게 & 카페')}`,
    kakao: `https://map.kakao.com/?q=${encodeURIComponent('안산 가게 & 카페')}`,
  });
});

describe('benefitLine (0050)', () => {
  it('여러 줄을 띄어쓰기로 잇고 줄 앞 번호와 줄표를 뗀다', () => {
    expect(benefitLine('음료 5개 이상 구매 시\n1. 아메리카노 s 사이즈 1개 증정\nor\n2. 아이스크림 토핑 증정')).toBe(
      '음료 5개 이상 구매 시 아메리카노 s 사이즈 1개 증정 or 아이스크림 토핑 증정'
    );
    expect(benefitLine('- 커피 10% 할인\n\n2) 디저트 500원 할인')).toBe('커피 10% 할인 디저트 500원 할인');
  });

  it('비었거나 없으면 null', () => {
    expect(benefitLine(null)).toBeNull();
    expect(benefitLine(' \n ')).toBeNull();
  });
});
