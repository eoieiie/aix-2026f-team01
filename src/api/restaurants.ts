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
}

export async function getSessionRestaurants(
  sessionId: string,
  client: Client = getSupabase()
): Promise<NearbyRestaurant[]> {
  const { data, error } = await client.rpc('session_restaurants', { p_session_id: sessionId });
  if (error) throw error;
  return ((data as any[]) ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    cuisine: r.cuisine ?? null,
    partner: Boolean(r.partner),
    couponText: r.coupon_text ?? null,
    match: r.match === 'menu' ? 'menu' : 'cuisine',
    myCode: r.my_code ?? null,
  }));
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

export const OSM_CREDIT = '© OpenStreetMap contributors';
