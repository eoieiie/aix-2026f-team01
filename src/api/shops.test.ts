/// <reference types="node" />
import { readFileSync } from 'fs';
import { join } from 'path';

import { COUPON_VALID_HOURS, PIN_MAX_TRIES, SHOP_STATS_MIN } from '@/constants';

import {
  type Coupon,
  couponErrorText,
  couponForSession,
  couponForShop,
  couponState,
  filterShops,
  formatKoreanTime,
  formatOpeningHours,
  getAdminBoard,
  getMyCoupons,
  getOwnerBoard,
  getShop,
  getShops,
  kakaoRouteUrl,
  naverMapUrl,
  redeemCoupon,
  redeemRate,
  type Shop,
  shopLine,
  shopPhotoUrl,
  shortAddress,
  splitCoupons,
  telUrl,
  timeLeft,
} from './shops';

const BASE = 'https://example.supabase.co';

// 실제 가게가 아닌 가짜 값
function shop(over: Partial<Shop> & { id: number }): Shop {
  return {
    name: `가게${over.id}`,
    cuisine: 'korean',
    partner: false,
    couponText: null,
    walkMinutes: null,
    openNow: null,
    photoUrl: null,
    thumbUrl: null,
    lat: null,
    lng: null,
    menus: [],
    ...over,
  };
}

function coupon(over: Partial<Coupon> & { id: string }): Coupon {
  return {
    restaurantId: 1,
    shopName: '가게1',
    benefit: '음료 한 캔',
    code: 'ABC123',
    source: 'shop',
    sessionId: null,
    claimedAt: '2026-11-25T03:00:00Z',
    expiresAt: '2026-11-26T03:00:00Z',
    redeemedAt: null,
    pinRequired: false,
    triesLeft: 5,
    ...over,
  };
}

const rpcClient = (data: unknown, error: unknown = null) => {
  const calls: { name: string; args: unknown }[] = [];
  const client = {
    rpc: async (name: string, args?: unknown) => {
      calls.push({ name, args });
      return { data, error };
    },
  } as any;
  return { client, calls };
};

describe('가게 목록과 상세 (4-26)', () => {
  it('서버 줄을 화면 값으로 바꾸고, 사진과 음식 그림 주소를 만든다', async () => {
    const { client, calls } = rpcClient([
      {
        id: 7, name: '한양 분식', cuisine: 'korean', partner: true, coupon_text: '음료 한 캔', walk_minutes: 3,
        open_now: true, photo_path: '7/1.jpg', thumb_food_id: 16, thumb_image: '16.webp', lat: 37.3, lng: 126.8,
        menus: ['떡볶이', '김밥'],
      },
      { id: 8, name: '옆 카페', cuisine: 'cafe', partner: false, coupon_text: '안 보여야 함', walk_minutes: null, open_now: null },
    ]);
    const list = await getShops(client, BASE);
    expect(calls[0].name).toBe('shop_list');
    expect(list[0]).toMatchObject({
      id: 7, partner: true, couponText: '음료 한 캔', walkMinutes: 3, openNow: true,
      photoUrl: `${BASE}/storage/v1/object/public/shop-photos/7/1.jpg`,
      thumbUrl: `${BASE}/storage/v1/object/public/food-images/16.webp`,
      menus: ['떡볶이', '김밥'],
    });
    expect(list[1]).toMatchObject({ couponText: null, photoUrl: null, thumbUrl: null, menus: [], lat: null });
  });

  it('사진 주소는 버킷 안 경로만 받는다', () => {
    expect(shopPhotoUrl(BASE + '/', '341/1.jpg')).toBe(`${BASE}/storage/v1/object/public/shop-photos/341/1.jpg`);
    expect(shopPhotoUrl(BASE, 'https://evil.example/a.jpg')).toBeNull();
    expect(shopPhotoUrl(BASE, '../a.jpg')).toBeNull();
    expect(shopPhotoUrl(BASE, null)).toBeNull();
    expect(shopPhotoUrl('', '341/1.jpg')).toBeNull();
  });

  it('상세는 사진 여러 장과 영업 신고 연도, 5팀이 넘을 때만 오는 다녀간 팀 수를 읽는다', async () => {
    const { client, calls } = rpcClient({
      id: 7, name: '한양 분식', cuisine: 'korean', partner: true, coupon_text: '음료 한 캔',
      address: '경기도 안산시 상록구 한양대학로 55 (사동)', phone: '031-400-0000', opening_hours: 'Mo-Fr 10:00-20:00',
      licensed_year: 2015, menus: ['떡볶이'], walk_minutes: 2, open_now: false, lat: 37.3, lng: 126.8,
      photos: [{ path: '7/1.jpg', credit: '사장님 제공' }, { path: 'bad path.jpg', credit: null }],
      thumb_food_id: 16, thumb_image: '16.webp', visits: null,
    });
    const d = await getShop(7, client, BASE);
    expect(calls[0]).toEqual({ name: 'shop_detail', args: { p_restaurant_id: 7 } });
    expect(d.photos).toEqual([{ url: `${BASE}/storage/v1/object/public/shop-photos/7/1.jpg`, credit: '사장님 제공' }]);
    expect(d.photoUrl).toBe(d.photos[0].url);
    expect(d).toMatchObject({ licensedYear: 2015, visits: null, phone: '031-400-0000', openNow: false });
  });

  it('종류와 검색어로 거른다. 검색은 이름과 대표 메뉴에서, 띄어쓰기를 보지 않는다', () => {
    const list = [
      shop({ id: 1, name: '북경 반점', cuisine: 'chinese', menus: ['짜장면', '짬뽕'] }),
      shop({ id: 2, name: '시저커피', cuisine: 'cafe', partner: true }),
      shop({ id: 3, name: '할매국수', cuisine: 'korean' }),
    ];
    expect(filterShops(list, 'all', '').map((s) => s.id)).toEqual([1, 2, 3]);
    expect(filterShops(list, 'cafe', '').map((s) => s.id)).toEqual([2]);
    expect(filterShops(list, 'partner', '').map((s) => s.id)).toEqual([2]);
    expect(filterShops(list, 'all', '북경반점').map((s) => s.id)).toEqual([1]);
    expect(filterShops(list, 'all', ' 짬뽕 ').map((s) => s.id)).toEqual([1]);
    expect(filterShops(list, 'korean', '짬뽕')).toEqual([]);
  });

  it('이름 아래 한 줄은 값이 있는 것만 잇는다', () => {
    expect(shopLine({ cuisine: 'korean', walkMinutes: 3, openNow: true })).toBe('한식 · 걸어서 3분 · 영업 중');
    expect(shopLine({ cuisine: 'cafe', walkMinutes: null, openNow: false })).toBe('카페 · 지금 닫음');
    expect(shopLine({ cuisine: null, walkMinutes: null, openNow: null })).toBe('');
  });

  it('주소는 도와 시, 끝의 동 이름을 뺀다', () => {
    expect(shortAddress('경기도 안산시 상록구 한양대학로 38, 2층 (사동)')).toBe('상록구 한양대학로 38, 2층');
    expect(shortAddress(null)).toBeNull();
  });

  it('영업시간 표기를 읽기 쉬운 줄로 바꾸고, 모르는 모양이면 보이지 않는다', () => {
    expect(formatOpeningHours('Mo-Su 10:00-22:00')).toEqual(['매일 10:00~22:00']);
    expect(formatOpeningHours('Mo-Fr 11:30-15:00, 17:00-21:00; Sa 11:30-16:00; Su off')).toEqual([
      '월~금 11:30~15:00, 17:00~21:00',
      '토 11:30~16:00',
      '일 쉬어요',
    ]);
    expect(formatOpeningHours('Mo-Fr 10:30-20:00; Sa,Su,PH off')).toEqual(['월~금 10:30~20:00', '토, 일, 공휴일 쉬어요']);
    expect(formatOpeningHours('11:00-21:00')).toEqual(['매일 11:00~21:00']);
    expect(formatOpeningHours('24/7')).toEqual(['24시간']);
    expect(formatOpeningHours('sunrise-sunset')).toBeNull();
    expect(formatOpeningHours('')).toBeNull();
    expect(formatOpeningHours(null)).toBeNull();
  });

  it('길찾기 주소: 네이버 지도는 이름으로 찾고, 카카오맵은 좌표가 있으면 그 자리까지', () => {
    expect(naverMapUrl({ name: '시저커피' })).toBe(`https://map.naver.com/p/search/${encodeURIComponent('안산 시저커피')}`);
    expect(kakaoRouteUrl({ name: '카페,돌체', lat: 37.3, lng: 126.8 })).toBe(
      `https://map.kakao.com/link/to/${encodeURIComponent('카페 돌체')},37.3,126.8`
    );
    expect(kakaoRouteUrl({ name: '시저커피', lat: null, lng: null })).toContain('/link/search/');
    expect(telUrl('031-502-7825')).toBe('tel:0315027825');
  });
});

describe('쿠폰함과 직원 확인 (4-27)', () => {
  const now = new Date('2026-11-25T05:00:00Z');

  it('쿠폰 상태: 쓸 수 있음, 씀, 기한 지남, 잠김', () => {
    expect(couponState(coupon({ id: 'a' }), now)).toBe('ready');
    expect(couponState(coupon({ id: 'b', redeemedAt: '2026-11-25T04:00:00Z' }), now)).toBe('used');
    expect(couponState(coupon({ id: 'c', expiresAt: '2026-11-25T04:59:00Z' }), now)).toBe('expired');
    expect(couponState(coupon({ id: 'd', pinRequired: true, triesLeft: 0 }), now)).toBe('locked');
    expect(couponState(coupon({ id: 'e', pinRequired: false, triesLeft: 0 }), now)).toBe('ready');
  });

  it('쿠폰함은 쓸 수 있는 것(곧 끝나는 순)과 지난 것(최근 순)으로 나눈다', () => {
    const list = [
      coupon({ id: 'late', expiresAt: '2026-11-26T03:00:00Z' }),
      coupon({ id: 'used', redeemedAt: '2026-11-25T04:00:00Z', claimedAt: '2026-11-25T02:00:00Z' }),
      coupon({ id: 'soon', expiresAt: '2026-11-25T06:00:00Z' }),
      coupon({ id: 'old', expiresAt: '2026-11-20T00:00:00Z', claimedAt: '2026-11-19T00:00:00Z' }),
    ];
    const { ready, past } = splitCoupons(list, now);
    expect(ready.map((c) => c.id)).toEqual(['soon', 'late']);
    expect(past.map((c) => c.id)).toEqual(['used', 'old']);
  });

  it('가게 화면은 쓸 수 있는 쿠폰을 먼저, 없으면 오늘 받아 이미 쓴 쿠폰을 보인다', () => {
    const used = coupon({ id: 'used', restaurantId: 7, redeemedAt: '2026-11-25T04:00:00Z' });
    const ready = coupon({ id: 'ready', restaurantId: 7 });
    const old = coupon({ id: 'old', restaurantId: 7, expiresAt: '2026-11-20T00:00:00Z' });
    expect(couponForShop([used, ready], 7, now)?.id).toBe('ready');
    expect(couponForShop([used], 7, now)?.id).toBe('used');
    expect(couponForShop([old], 7, now)).toBeNull();
    expect(couponForShop([ready], 8, now)).toBeNull();
    // 판에서 받아 쓴 쿠폰은 가게 화면에서 새로 받는 것을 막지 않는다
    const sessionUsed = coupon({ id: 'su', restaurantId: 7, source: 'session', sessionId: 'S1', redeemedAt: '2026-11-25T04:00:00Z' });
    expect(couponForShop([sessionUsed], 7, now)).toBeNull();
  });

  it('판 결과의 쿠폰은 판과 가게로 찾는다', () => {
    const list = [coupon({ id: 's', source: 'session', sessionId: 'S1', restaurantId: 7 })];
    expect(couponForSession(list, 'S1', 7)?.id).toBe('s');
    expect(couponForSession(list, 'S2', 7)).toBeNull();
  });

  it('쿠폰함 줄을 화면 값으로 바꾼다', async () => {
    const { client, calls } = rpcClient([
      {
        id: 'c1', restaurant_id: 7, shop_name: '한양 분식', benefit: '음료 한 캔', code: 'ABC123', source: 'session',
        session_id: 'S1', claimed_at: '2026-11-25T03:00:00Z', expires_at: '2026-11-26T03:00:00Z', redeemed_at: null,
        pin_required: true, tries_left: 4,
      },
    ]);
    const list = await getMyCoupons(client);
    expect(calls[0].name).toBe('my_coupons');
    expect(list[0]).toMatchObject({ id: 'c1', restaurantId: 7, source: 'session', sessionId: 'S1', pinRequired: true, triesLeft: 4 });
  });

  it('직원 확인: 맞으면 쓴 시각, 비밀번호가 틀리면 남은 횟수가 값으로 온다', async () => {
    const ok = rpcClient({ ok: true, redeemed_at: '2026-11-25T05:00:00Z' });
    expect(await redeemCoupon('c1', '1234', ok.client)).toEqual({ ok: true, redeemedAt: '2026-11-25T05:00:00Z' });
    expect(ok.calls[0]).toEqual({ name: 'redeem_coupon', args: { p_claim_id: 'c1', p_pin: '1234' } });
    const wrong = rpcClient({ ok: false, reason: 'wrong_pin', tries_left: 3 });
    expect(await redeemCoupon('c1', '0000', wrong.client)).toEqual({ ok: false, reason: 'wrong_pin', triesLeft: 3 });
    const locked = rpcClient({ ok: false, reason: 'locked', tries_left: 0 });
    expect(await redeemCoupon('c1', '0000', locked.client)).toEqual({ ok: false, reason: 'locked', triesLeft: 0 });
    const used = rpcClient(null, { message: 'already_used' });
    await expect(redeemCoupon('c1', null, used.client)).rejects.toMatchObject({ message: 'already_used' });
  });

  it('오류는 한국어 한 문장으로 보인다. 서버 말을 그대로 보이지 않는다', () => {
    expect(couponErrorText({ message: 'already_used' })).toBe('이미 쓴 쿠폰이에요');
    expect(couponErrorText({ message: 'expired' })).toBe('기한이 지난 쿠폰이에요');
    expect(couponErrorText({ message: 'not_partner' })).toBe('지금은 쿠폰을 받을 수 없는 가게예요');
    expect(couponErrorText(new Error('Failed to fetch'))).toBe('연결을 확인하고 다시 눌러 주세요');
  });

  it('시각은 한국 시간으로, 남은 시간은 시간이나 분으로', () => {
    expect(formatKoreanTime('2026-11-25T05:32:00Z')).toBe('11월 25일 오후 2:32');
    expect(formatKoreanTime('2026-11-24T15:05:00Z')).toBe('11월 25일 오전 12:05');
    expect(formatKoreanTime('')).toBe('');
    expect(timeLeft('2026-11-25T08:10:00Z', now)).toBe('3시간 남음');
    expect(timeLeft('2026-11-25T05:20:00Z', now)).toBe('20분 남음');
    expect(timeLeft('2026-11-25T05:00:20Z', now)).toBe('1분 남음');
  });

  it('쿠폰 규칙 숫자는 서버(0033 coupon_rule)와 같다', () => {
    const sql = readFileSync(join(__dirname, '../../supabase/migrations/0033_coupon_redeem.sql'), 'utf8');
    const json = /function public\.coupon_rule\(p_name text\)[\s\S]*?'(\{[^']*\})'::jsonb/.exec(sql);
    expect(json).not.toBeNull();
    expect(JSON.parse((json as RegExpExecArray)[1])).toEqual({ COUPON_VALID_HOURS, PIN_MAX_TRIES, SHOP_STATS_MIN });
  });
});

describe('쿠폰 현황판 (4-28)', () => {
  it('운영자 현황판 값을 읽고, 빠진 칸은 0으로 채운다', async () => {
    const { client, calls } = rpcClient({
      days: 30,
      totals: { claimed: 4, redeemed: 3, people: 9, shops: 2 },
      shops: [{ id: 7, name: '한양 분식', claimed: 3, redeemed: 3, people: 9, last_redeemed_at: '2026-11-25T05:00:00Z' }],
      recent: [
        { names: '민준, 서연', shop: '한양 분식', menu: '떡볶이', people: 3, claimed_at: '2026-11-25T03:00:00Z',
          redeemed_at: null, source: 'session' },
      ],
      dow_claimed: [0, 0, 4, 0, 0, 0, 0],
      hour_claimed: [1],
    });
    const b = await getAdminBoard(30, 'zz_test', client);
    expect(calls[0]).toEqual({ name: 'admin_coupon_board', args: { p_days: 30, p_area: 'zz_test' } });
    expect(b.totals).toEqual({ claimed: 4, redeemed: 3, people: 9, shops: 2 });
    expect(b.recent[0]).toMatchObject({ names: '민준, 서연', menu: '떡볶이', redeemedAt: null, source: 'session' });
    expect(b.dowClaimed).toEqual([0, 0, 4, 0, 0, 0, 0]);
    expect(b.dowRedeemed).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(b.hourClaimed).toHaveLength(24);
    expect(redeemRate(b.totals)).toBe(75);
    expect(redeemRate({ claimed: 0, redeemed: 0 })).toBeNull();
  });

  it('사장님 현황은 이름이 없고, 5팀이 안 되면 분포가 null이다', async () => {
    const { client, calls } = rpcClient({
      shop: { name: '한양 분식', benefit: '음료 한 캔', partner: true, pin_set: true },
      week: { claimed: 2, redeemed: 1, people: 3 },
      total: { claimed: 3, redeemed: 2, people: 6 },
      min_teams: 5, hour_claimed: null, hour_redeemed: null, menus: null,
    });
    const b = await getOwnerBoard('t'.repeat(40), client);
    expect(calls[0].name).toBe('owner_board');
    expect(b).toEqual({
      shop: { name: '한양 분식', benefit: '음료 한 캔', pinSet: true },
      week: { claimed: 2, redeemed: 1, people: 3 },
      total: { claimed: 3, redeemed: 2, people: 6 },
      minTeams: 5, hourClaimed: null, hourRedeemed: null, menus: null,
    });
  });
});
