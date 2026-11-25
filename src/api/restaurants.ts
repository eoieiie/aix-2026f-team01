import { VOTE_RESTAURANTS_SHOWN } from '@/constants';

import type { Client } from './groups';
import type { CouncilBenefit } from './council-benefits';
import { getSupabase } from './supabase';

type CouncilCollege = CouncilBenefit['college'];

// 학교 앞 식당 (spec.md 4-21). 결과 뒤(0015)와 투표 화면 추천 칸(0016).
// 보이기만 하고 투표와 룰렛 확률에는 쓰지 않는다

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
  // 아래부터 0016. 0016 전의 서버는 이 칸을 주지 않아서 null(간 모임 수는 0)로 읽는다
  // 메뉴가 맞은 음식. 종류만 맞으면 null
  foodId: number | null;
  // 정문에서 걸어서 몇 분
  walkMinutes: number | null;
  // 지금 영업 중이면 true, 닫았으면 false, 영업시간을 모르면 null
  openNow: boolean | null;
  // 밥BTI로 간 모임 수(쿠폰을 받은 서로 다른 판 수)
  teamCount: number;
  // 제휴 식당이 직접 준 사진
  photoUrl: string | null;
  // 아래부터 0048. 내 단과대나 총학생회의 학생회 제휴(돈 관계가 없어 "광고"가 아니다)와 그 혜택 첫 줄
  councilCollege: CouncilCollege | null;
  councilText: string | null;
  // 이 판에 맞는 가게 수. 보인 곳보다 많으면 "더 보기"
  total: number;
  // 끝난 판의 메뉴 이름과 종류. "더 보기"로 가게 탭을 이 이름으로 찾은 채 연다
  menuName: string | null;
  menuCuisine: string | null;
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
    // 혜택 문구가 있는 제휴만 "광고"와 먼저 줄 세우기(0040). 서버도 같게 주지만 화면에서 한 번 더
    partner: offer(r),
    couponText: offer(r) ? r.coupon_text : null,
    match: r.match === 'menu' ? 'menu' : 'cuisine',
    myCode: r.my_code ?? null,
    lat: typeof r.lat === 'number' ? r.lat : coords.get(r.id)?.lat ?? null,
    lng: typeof r.lng === 'number' ? r.lng : coords.get(r.id)?.lng ?? null,
    foodId: typeof r.food_id === 'number' ? r.food_id : null,
    walkMinutes: typeof r.walk_minutes === 'number' ? r.walk_minutes : null,
    openNow: typeof r.open_now === 'boolean' ? r.open_now : null,
    teamCount: typeof r.team_count === 'number' ? r.team_count : 0,
    // 사진은 제휴 식당에만 (서버도 막지만 화면에서 한 번 더)
    photoUrl: r.partner && typeof r.photo_url === 'string' ? r.photo_url : null,
    ...councilOf(r),
    total: typeof r.total_count === 'number' ? r.total_count : rows.length,
    menuName: typeof r.menu_name === 'string' ? r.menu_name : null,
    menuCuisine: typeof r.menu_cuisine === 'string' ? r.menu_cuisine : null,
  }));
}

// 학생회 제휴 칸 (0048). 0048 전의 서버는 주지 않아 null
function councilOf(r: any): { councilCollege: CouncilCollege | null; councilText: string | null } {
  const college = typeof r.council_college === 'string' ? (r.council_college as CouncilCollege) : null;
  const text = typeof r.council_text === 'string' && r.council_text.trim() !== '' ? r.council_text.trim() : null;
  return { councilCollege: college, councilText: college ? text : null };
}

// 제휴이면서 혜택 문구가 있는가 (0040). 문구가 없는 제휴는 보통 가게처럼 보인다
function offer(r: any): boolean {
  return Boolean(r.partner) && typeof r.coupon_text === 'string' && r.coupon_text.trim() !== '';
}

// 식당 줄을 누르면 여는 카카오맵 주소. 키가 필요 없는 공개 링크다(앱이 깔려 있으면 휴대폰이 앱으로 넘긴다).
// 좌표가 있으면 그 자리에 핀, 없으면 이름으로 찾기
export function kakaoMapUrl(r: Pick<NearbyRestaurant, 'name' | 'lat' | 'lng'>): string {
  const name = encodeURIComponent(r.name.replace(/,/g, ' '));
  if (r.lat !== null && r.lng !== null) return `https://map.kakao.com/link/map/${name},${r.lat},${r.lng}`;
  return `https://map.kakao.com/link/search/${encodeURIComponent('안산 ' + r.name)}`;
}

// 먹고 나서 카페 (spec.md 4-23, 0020, 0048). 쿠폰 카페, 내 학생회 제휴 카페, 정문에서 가까운 순으로 서버가 3곳까지 준다
export interface NearbyCafe {
  id: number;
  name: string;
  partner: boolean;
  couponText: string | null;
  myCode: string | null;
  lat: number | null;
  lng: number | null;
  councilCollege: CouncilCollege | null;
  councilText: string | null;
  total: number;
}

export async function getSessionCafes(sessionId: string, client: Client = getSupabase()): Promise<NearbyCafe[]> {
  const { data, error } = await client.rpc('session_cafes', { p_session_id: sessionId });
  if (error) throw error;
  const rows = (data as any[]) ?? [];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    partner: offer(r),
    couponText: offer(r) ? r.coupon_text : null,
    myCode: r.my_code ?? null,
    lat: typeof r.lat === 'number' ? r.lat : null,
    lng: typeof r.lng === 'number' ? r.lng : null,
    ...councilOf(r),
    total: typeof r.total_count === 'number' ? r.total_count : rows.length,
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

// 이름 아래 한 줄의 조각들: 걸어서 N분, 영업 중, 밥BTI로 간 모임 N팀 중 값이 있는 것만 (4-21, 2026-11-16).
// 닫았으면 "지금 닫음". 셋 다 모르면 줄이 비지 않게 종류(한식 등)를 보인다.
// 화면은 조각을 간격 8로 떨어뜨려 놓는다(기호로 잇지 않는다, 2026-11-25)
export function restaurantInfo(
  r: Pick<NearbyRestaurant, 'walkMinutes' | 'openNow' | 'teamCount' | 'cuisine'>
): string[] {
  const parts: string[] = [];
  if (r.walkMinutes !== null) parts.push(`걸어서 ${r.walkMinutes}분`);
  if (r.openNow === true) parts.push('영업 중');
  if (r.openNow === false) parts.push('지금 닫음');
  if (r.teamCount > 0) parts.push(`밥BTI로 간 모임 ${r.teamCount}팀`);
  if (parts.length > 0) return parts;
  const kind = r.cuisine ? CUISINE_LABELS[r.cuisine] : undefined;
  return kind ? [kind] : [];
}

export interface Taste {
  // 네 글자 축 점수(-1, 0, 1). 네 글자를 만든 적이 없으면 null
  axes: Record<string, number> | null;
  // 내가 먹어 본 음식
  eatenFoodIds: ReadonlySet<number>;
}

// 투표 화면 추천 칸 (4-21). 서버가 준 최대 6곳(0048 순서: 쿠폰 가게, 내 학생회 제휴, 메뉴 맞음, 가까운 순)에서 3곳.
// 쿠폰 가게가 먼저(#53 11/19 병주 요청, 이름 옆 "광고"는 숨기지 않는다), 그다음 내 학생회 제휴. 지금 닫은 곳은 먼저 오지 않는다.
// 그 안에서는 내 취향 점수 순: 메뉴가 맞으면 +2. 한식↔외국음식 축과 종류가 맞으면 +1.
// 탐험이면 안 먹어 본 음식, 반복이면 먹어 본 음식에 +1. 지금 닫았으면 -3. 점수가 같으면 서버 순서
export function pickForMe(
  list: readonly NearbyRestaurant[],
  taste: Taste,
  count: number = VOTE_RESTAURANTS_SHOWN
): NearbyRestaurant[] {
  const korean = taste.axes?.korean ?? 0;
  const explore = taste.axes?.explore ?? 0;
  const score = (r: NearbyRestaurant) => {
    let s = r.match === 'menu' ? 2 : 0;
    if (r.cuisine !== null && korean !== 0 && (korean > 0) === (r.cuisine === 'korean')) s += 1;
    if (r.foodId !== null && explore !== 0 && (explore > 0) !== taste.eatenFoodIds.has(r.foodId)) s += 1;
    if (r.openNow === false) s -= 3;
    return s;
  };
  const first = (r: NearbyRestaurant) =>
    r.openNow === false ? 0 : r.partner ? 2 : r.councilCollege !== null ? 1 : 0;
  return list
    .map((r, i) => ({ r, i, p: first(r), s: score(r) }))
    .sort((a, b) => b.p - a.p || b.s - a.s || a.i - b.i)
    .slice(0, count)
    .map((x) => x.r);
}

// 식당 목록 출처: 오픈스트리트맵(ODbL, 표시 필요)과 공공데이터포털 일반음식점(0017)
export const OSM_CREDIT = '© OpenStreetMap contributors, 공공데이터포털';
