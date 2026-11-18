import type { Client } from './groups';
import { getSupabase } from './supabase';

// 결과 뒤 학교 앞 식당 (spec.md 4-21, 0015). 투표와 룰렛에는 쓰지 않는다

export interface NearbyRestaurant {
  id: number;
  name: string;
  cuisine: string | null;
  // 제휴 식당. 화면에서 이름 옆에 "광고"를 붙인다 (공정위 추천·보증 심사지침)
  partner: boolean;
  couponText: string | null;
  // menu: 가게 이름이나 대표 메뉴에 음식 이름이 있다, cuisine: 같은 종류
  match: 'menu' | 'cuisine';
  // 이 판에서 내가 받은 쿠폰 코드
  myCode: string | null;
  // 지도 앱으로 열 위치. 못 읽으면 null이고 이름으로 찾는다
  lat: number | null;
  lng: number | null;
}

export async function getSessionRestaurants(
  sessionId: string,
  client: Client = getSupabase()
): Promise<NearbyRestaurant[]> {
  const { data, error } = await client.rpc('session_restaurants', { p_session_id: sessionId });
  if (error) throw error;
  const rows = (data as any[]) ?? [];
  // 서버 함수가 좌표를 주지 않으면 식당 표에서 따로 읽는다 (식당 표는 로그인한 사람 누구나 읽는다, 0015).
  // 못 읽어도 목록은 그대로 보인다
  const coords = new Map<number, { lat: number; lng: number }>();
  const missing = rows.filter((r) => r.lat == null || r.lng == null).map((r) => r.id);
  if (missing.length > 0 && typeof (client as any).from === 'function') {
    try {
      const { data: pts } = await client.from('restaurants').select('id, lat, lng').in('id', missing);
      for (const p of (pts as any[]) ?? []) {
        if (typeof p.lat === 'number' && typeof p.lng === 'number') coords.set(p.id, { lat: p.lat, lng: p.lng });
      }
    } catch {
      // 좌표 없이 이름으로 찾는다
    }
  }
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    cuisine: r.cuisine ?? null,
    partner: Boolean(r.partner),
    couponText: r.coupon_text ?? null,
    match: r.match === 'menu' ? 'menu' : 'cuisine',
    myCode: r.my_code ?? null,
    lat: typeof r.lat === 'number' ? r.lat : coords.get(r.id)?.lat ?? null,
    lng: typeof r.lng === 'number' ? r.lng : coords.get(r.id)?.lng ?? null,
  }));
}

// 식당 줄을 누르면 여는 카카오맵 주소. 키가 필요 없는 공개 링크다(앱이 깔려 있으면 휴대폰이 앱으로 넘긴다).
// 좌표가 있으면 그 자리에 핀, 없으면 이름으로 찾기
export function kakaoMapUrl(r: Pick<NearbyRestaurant, 'name' | 'lat' | 'lng'>): string {
  const name = encodeURIComponent(r.name.replace(/,/g, ' '));
  if (r.lat !== null && r.lng !== null) return `https://map.kakao.com/link/map/${name},${r.lat},${r.lng}`;
  return `https://map.kakao.com/link/search/${encodeURIComponent('안산 ' + r.name)}`;
}

export async function claimCoupon(
  sessionId: string,
  restaurantId: number,
  client: Client = getSupabase()
): Promise<string> {
  const { data, error } = await client.rpc('claim_coupon', {
    p_session_id: sessionId,
    p_restaurant_id: restaurantId,
  });
  if (error) throw error;
  return String(data);
}

// 결과 카드 화면은 식사 id로 열려서 판 id를 따로 읽는다
export async function getSessionIdForMeal(mealId: string, client: Client = getSupabase()): Promise<string | null> {
  const { data, error } = await client.from('meals').select('session_id').eq('id', mealId).maybeSingle();
  if (error) throw error;
  return (data as { session_id?: string } | null)?.session_id ?? null;
}

const CUISINE_LABELS: Record<string, string> = {
  korean: '한식',
  chinese: '중식',
  japanese: '일식',
  western: '양식',
  asian: '아시안',
};

// 줄 아래 한 줄: 메뉴가 맞으면 "칼국수 있어요", 아니면 종류
export function restaurantLine(r: Pick<NearbyRestaurant, 'match' | 'cuisine'>, foodName: string): string {
  if (r.match === 'menu') return `${foodName} 있어요`;
  return r.cuisine ? CUISINE_LABELS[r.cuisine] ?? '' : '';
}

// 식당 목록 출처: 오픈스트리트맵(ODbL, 표시 필요)과 공공데이터포털 일반음식점(0017)
export const OSM_CREDIT = '© OpenStreetMap contributors, 공공데이터포털';
