import type { Client } from './groups';
import { FOOD_IMAGE_BUCKET } from './food-images';
import { getSupabase } from './supabase';
import { collegeLabel } from '@/constants/prefs';

// 가게 탭과 가게 상세(spec.md 4-26), 쿠폰함과 직원 확인(4-27), 쿠폰 현황판(4-28).
// 가게 정보는 공공데이터와 오픈스트리트맵, 사진은 사장님이 주거나 팀이 찍은 것만 쓴다

export const SHOP_PHOTO_BUCKET = 'shop-photos';

export type ShopKind = 'all' | 'partner' | 'korean' | 'chinese' | 'japanese' | 'western' | 'asian' | 'cafe';

// 가게 탭 위 종류 고르기. 같은 폭 격자 4칸 두 줄
export const SHOP_KINDS: readonly { key: ShopKind; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'partner', label: '제휴' },
  { key: 'korean', label: '한식' },
  { key: 'chinese', label: '중식' },
  { key: 'japanese', label: '일식' },
  { key: 'western', label: '양식' },
  { key: 'asian', label: '아시안' },
  { key: 'cafe', label: '카페' },
];

const CUISINE_LABELS: Record<string, string> = {
  korean: '한식',
  chinese: '중식',
  japanese: '일식',
  western: '양식',
  asian: '아시안',
  cafe: '카페',
};

export function cuisineLabel(cuisine: string | null): string {
  return cuisine ? CUISINE_LABELS[cuisine] ?? '' : '';
}

export interface Shop {
  id: number;
  name: string;
  cuisine: string | null;
  // 혜택 문구가 있는 제휴 가게. 이름 옆에 "광고"를 붙이고 먼저 줄 세운다.
  // 문구가 없는 제휴는 보통 가게로 본다(혜택이 없는데 광고 표시가 붙으면 관계를 잘못 알린다, 0040)
  partner: boolean;
  couponText: string | null;
  walkMinutes: number | null;
  openNow: boolean | null;
  // 가게 사진(사장님이 주거나 팀이 찍은 것). 없으면 null
  photoUrl: string | null;
  // 사진이 없을 때 쓰는 그림: 이름이나 대표 메뉴로 찾은 음식 그림, 카페는 카페 그림(0040).
  // 못 찾으면 null이고 화면이 옅은 칸에 종류 이름을 그린다(엉뚱한 음식 그림보다 낫다)
  thumbUrl: string | null;
  lat: number | null;
  lng: number | null;
  menus: string[];
}

export interface ShopDetail extends Shop {
  address: string | null;
  phone: string | null;
  // 오픈스트리트맵 표기 그대로. 화면은 formatOpeningHours로 바꿔 보인다
  openingHours: string | null;
  // 영업 신고 연도(공공데이터 인허가일)
  licensedYear: number | null;
  photos: { url: string; credit: string | null }[];
  // 쿠폰을 쓰고 다녀간 팀 수. 5팀이 안 되면 서버가 주지 않는다
  visits: number | null;
}

function storageUrl(base: string, bucket: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/storage/v1/object/public/${bucket}/${path}`;
}

// 가게 사진 주소. 버킷 안 경로만 받는다(0032의 check와 같은 모양)
export function shopPhotoUrl(base: string, path: string | null | undefined): string | null {
  if (!base || !path || !/^[a-z0-9][a-z0-9/_-]*\.(jpg|jpeg|png|webp)$/.test(path)) return null;
  return storageUrl(base, SHOP_PHOTO_BUCKET, path);
}

// 음식 그림(음식 id 파일)과 카페 그림(cafe/coffee, cafe/bread, cafe/dessert, 0040)
function foodThumbUrl(base: string, path: string | null | undefined): string | null {
  if (!base || !path || !/^([0-9]+|cafe\/[a-z]+)\.(webp|png)$/.test(path)) return null;
  return storageUrl(base, FOOD_IMAGE_BUCKET, path);
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null);

function toShop(r: any, base: string): Shop {
  const couponText = r.partner ? str(r.coupon_text) : null;
  return {
    id: r.id,
    name: r.name,
    cuisine: str(r.cuisine),
    partner: couponText !== null,
    couponText,
    walkMinutes: num(r.walk_minutes),
    openNow: typeof r.open_now === 'boolean' ? r.open_now : null,
    photoUrl: shopPhotoUrl(base, r.photo_path),
    thumbUrl: foodThumbUrl(base, r.thumb_image),
    lat: num(r.lat),
    lng: num(r.lng),
    menus: Array.isArray(r.menus) ? r.menus.filter((m: unknown) => typeof m === 'string') : [],
  };
}

const supabaseBase = () => process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

export async function getShops(client: Client = getSupabase(), base: string = supabaseBase()): Promise<Shop[]> {
  const { data, error } = await client.rpc('shop_list');
  if (error) throw error;
  return ((data as any[]) ?? []).map((r) => toShop(r, base));
}

export async function getShop(
  id: number,
  client: Client = getSupabase(),
  base: string = supabaseBase()
): Promise<ShopDetail> {
  const { data, error } = await client.rpc('shop_detail', { p_restaurant_id: id });
  if (error) throw error;
  const r = (data ?? {}) as any;
  const photos = (Array.isArray(r.photos) ? r.photos : [])
    .map((p: any) => ({ url: shopPhotoUrl(base, p?.path), credit: str(p?.credit) }))
    .filter((p: { url: string | null }): p is { url: string; credit: string | null } => p.url !== null);
  return {
    ...toShop({ ...r, photo_path: null }, base),
    photoUrl: photos[0]?.url ?? null,
    address: str(r.address),
    phone: str(r.phone),
    openingHours: str(r.opening_hours),
    licensedYear: num(r.licensed_year),
    photos,
    visits: num(r.visits),
  };
}

// 종류와 검색어로 거른다. 검색어는 가게 이름과 대표 메뉴에서 찾는다(띄어쓰기와 대소문자는 보지 않는다)
export function filterShops(list: readonly Shop[], kind: ShopKind, query: string): Shop[] {
  const q = query.replace(/\s+/g, '').toLowerCase();
  return list.filter((s) => {
    if (kind === 'partner' ? !s.partner : kind !== 'all' && s.cuisine !== kind) return false;
    if (q === '') return true;
    const hay = [s.name, ...s.menus].map((t) => t.replace(/\s+/g, '').toLowerCase());
    return hay.some((t) => t.includes(q));
  });
}

// 이름 아래 한 줄의 조각들: 종류, 걸어서 몇 분, 영업 중 중 값이 있는 것만.
// 화면은 조각을 간격 8로 떨어뜨려 놓는다(가운뎃점 같은 기호로 잇지 않는다, 2026-11-25)
export function shopLine(s: Pick<Shop, 'cuisine' | 'walkMinutes' | 'openNow'>): string[] {
  const parts: string[] = [];
  const kind = cuisineLabel(s.cuisine);
  if (kind) parts.push(kind);
  if (s.walkMinutes !== null) parts.push(`걸어서 ${s.walkMinutes}분`);
  if (s.openNow === true) parts.push('영업 중');
  if (s.openNow === false) parts.push('지금 닫음');
  return parts;
}

// "경기도 안산시 상록구 한양대학로 38, 2층 (사동)" → "상록구 한양대학로 38, 2층". 같은 도시라 앞과 동 이름은 뺀다
export function shortAddress(address: string | null): string | null {
  if (!address) return null;
  const t = address
    .replace(/^경기도\s+/, '')
    .replace(/^안산시\s+/, '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim();
  return t === '' ? null : t;
}

const DAY_LABELS: Record<string, string> = {
  Mo: '월',
  Tu: '화',
  We: '수',
  Th: '목',
  Fr: '금',
  Sa: '토',
  Su: '일',
  PH: '공휴일',
};
const DAY = '(?:Mo|Tu|We|Th|Fr|Sa|Su|PH)';
const RULE = new RegExp(
  `^(?:(${DAY}(?:\\s*[-,]\\s*${DAY})*)\\s+)?(off|closed|\\d{1,2}:\\d{2}\\s*-\\s*\\d{1,2}:\\d{2}(?:\\s*,\\s*\\d{1,2}:\\d{2}\\s*-\\s*\\d{1,2}:\\d{2})*)$`
);

// 오픈스트리트맵 영업시간 표기를 읽기 쉬운 줄로. 서버 is_open_now(0016)가 읽는 모양만 바꾸고, 못 읽는 모양이면 null(화면에 안 보인다)
//   "Mo-Fr 11:30-15:00, 17:00-21:00; Sa 11:30-16:00; Su off" → ["월~금 11:30~15:00, 17:00~21:00", "토 11:30~16:00", "일 쉬어요"]
export function formatOpeningHours(raw: string | null): string[] | null {
  if (!raw || raw.trim() === '') return null;
  if (raw.trim() === '24/7') return ['24시간'];
  const out: string[] = [];
  for (const rule of raw.split(';').map((r) => r.trim()).filter((r) => r !== '')) {
    const m = RULE.exec(rule);
    if (!m) return null;
    const days = m[1]
      ? m[1]
          .replace(/\s+/g, '')
          .split(',')
          .map((part) =>
            part
              .split('-')
              .map((d) => DAY_LABELS[d])
              .join('~')
          )
          .join(', ')
      : '매일';
    const label = days === '월~일' ? '매일' : days;
    const times =
      m[2] === 'off' || m[2] === 'closed'
        ? '쉬어요'
        : m[2]
            .split(',')
            .map((t) => t.replace(/\s+/g, '').replace('-', '~'))
            .join(', ');
    out.push(`${label} ${times}`);
  }
  return out.length > 0 ? out : null;
}

// 네이버 지도에서 가게 찾기. 키가 필요 없는 공개 주소다(앱이 깔려 있으면 휴대폰이 앱으로 넘긴다)
export function naverMapUrl(s: Pick<Shop, 'name'>): string {
  return `https://map.naver.com/p/search/${encodeURIComponent('안산 ' + s.name)}`;
}

// 카카오맵 길찾기. 좌표가 있으면 그 자리까지, 없으면 이름으로 찾기
export function kakaoRouteUrl(s: Pick<Shop, 'name' | 'lat' | 'lng'>): string {
  const name = encodeURIComponent(s.name.replace(/,/g, ' '));
  if (s.lat !== null && s.lng !== null) return `https://map.kakao.com/link/to/${name},${s.lat},${s.lng}`;
  return `https://map.kakao.com/link/search/${encodeURIComponent('안산 ' + s.name)}`;
}

export function telUrl(phone: string): string {
  return `tel:${phone.replace(/[^0-9+]/g, '')}`;
}

// ---- 쿠폰 (4-27)

export interface Coupon {
  id: string;
  restaurantId: number;
  shopName: string;
  benefit: string;
  code: string;
  // session: 판 결과에서 받음(한 팀에 하나), shop: 가게 화면에서 받음(한 사람 하루 1장)
  source: 'session' | 'shop';
  sessionId: string | null;
  claimedAt: string;
  expiresAt: string;
  redeemedAt: string | null;
  // 가게에 직원 확인 비밀번호가 있다
  pinRequired: boolean;
  triesLeft: number;
}

export type CouponState = 'ready' | 'used' | 'expired' | 'locked';

function toCoupon(r: any): Coupon {
  return {
    id: String(r.id),
    restaurantId: Number(r.restaurant_id),
    shopName: String(r.shop_name ?? ''),
    benefit: String(r.benefit ?? ''),
    code: String(r.code ?? ''),
    source: r.source === 'shop' ? 'shop' : 'session',
    sessionId: str(r.session_id),
    claimedAt: String(r.claimed_at),
    expiresAt: String(r.expires_at),
    redeemedAt: str(r.redeemed_at),
    pinRequired: Boolean(r.pin_required),
    triesLeft: typeof r.tries_left === 'number' ? r.tries_left : 0,
  };
}

export async function getMyCoupons(client: Client = getSupabase()): Promise<Coupon[]> {
  const { data, error } = await client.rpc('my_coupons');
  if (error) throw error;
  return ((data as any[]) ?? []).map(toCoupon);
}

// 가게 화면에서 쿠폰 받기. 한 가게에서 하루 1장이고, 다시 누르면 오늘 받은 쿠폰의 id가 온다
export async function claimShopCoupon(restaurantId: number, client: Client = getSupabase()): Promise<string> {
  const { data, error } = await client.rpc('claim_shop_coupon', { p_restaurant_id: restaurantId });
  if (error) throw error;
  return String(data);
}

export type RedeemResult =
  | { ok: true; redeemedAt: string }
  | { ok: false; reason: 'wrong_pin' | 'locked'; triesLeft: number };

// 직원 확인. 비밀번호가 틀리면 예외가 아니라 값으로 온다(틀린 횟수가 서버에 남아야 해서)
export async function redeemCoupon(
  couponId: string,
  pin: string | null,
  client: Client = getSupabase()
): Promise<RedeemResult> {
  const { data, error } = await client.rpc('redeem_coupon', { p_claim_id: couponId, p_pin: pin });
  if (error) throw error;
  const r = (data ?? {}) as any;
  if (r.ok === true) return { ok: true, redeemedAt: String(r.redeemed_at) };
  return {
    ok: false,
    reason: r.reason === 'locked' ? 'locked' : 'wrong_pin',
    triesLeft: typeof r.tries_left === 'number' ? r.tries_left : 0,
  };
}

export function couponState(c: Pick<Coupon, 'redeemedAt' | 'expiresAt' | 'pinRequired' | 'triesLeft'>, now: Date): CouponState {
  if (c.redeemedAt) return 'used';
  if (new Date(c.expiresAt).getTime() <= now.getTime()) return 'expired';
  if (c.pinRequired && c.triesLeft <= 0) return 'locked';
  return 'ready';
}

// 쿠폰함 나누기: 지금 쓸 수 있는 것(곧 끝나는 순)과 지난 것(쓴 것, 기한이 지난 것, 잠긴 것. 최근 순)
export function splitCoupons(list: readonly Coupon[], now: Date): { ready: Coupon[]; past: Coupon[] } {
  const ready = list
    .filter((c) => couponState(c, now) === 'ready')
    .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime());
  const past = list
    .filter((c) => couponState(c, now) !== 'ready')
    .sort((a, b) => new Date(b.claimedAt).getTime() - new Date(a.claimedAt).getTime());
  return { ready, past };
}

// 이 가게에서 지금 내가 가진 쿠폰: 쓸 수 있는 것이 먼저, 없으면 오늘(최근 24시간) 받아서 이미 쓴 것
export function couponForShop(list: readonly Coupon[], restaurantId: number, now: Date): Coupon | null {
  const mine = list.filter((c) => c.restaurantId === restaurantId && new Date(c.expiresAt).getTime() > now.getTime());
  const ready = mine.find((c) => couponState(c, now) === 'ready');
  if (ready) return ready;
  // 다 쓴 쿠폰은 오늘(한국 날짜) 가게 화면에서 받은 것만 보인다. 판에서 받아 쓴 쿠폰은 가게 화면의 "쿠폰 받기"를 막지 않는다
  const today = koreanDay(now.toISOString());
  return mine.find((c) => c.source === 'shop' && koreanDay(c.claimedAt) === today) ?? null;
}

function koreanDay(iso: string): string {
  return new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}

// 판 결과에서 받은 쿠폰 찾기(식당 줄과 카페 줄이 쓴다)
export function couponForSession(list: readonly Coupon[], sessionId: string, restaurantId: number): Coupon | null {
  return list.find((c) => c.sessionId === sessionId && c.restaurantId === restaurantId) ?? null;
}

// "11월 25일 오후 2:32". 쿠폰을 받은 때와 쓴 때에 쓴다. 한국 시간으로 보인다
export function formatKoreanTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const k = new Date(d.getTime() + 9 * 3600_000);
  const h = k.getUTCHours();
  const mm = String(k.getUTCMinutes()).padStart(2, '0');
  return `${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일 ${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}:${mm}`;
}

// 남은 시간 한 줄: "3시간 남음", "20분 남음"
export function timeLeft(expiresAt: string, now: Date): string {
  const min = Math.max(0, Math.floor((new Date(expiresAt).getTime() - now.getTime()) / 60_000));
  if (min >= 60) return `${Math.floor(min / 60)}시간 남음`;
  return `${Math.max(1, min)}분 남음`;
}

// 서버가 던지는 쿠폰 오류를 한국어 한 문장으로. 모르는 오류는 연결 문제로 안내한다
export function couponErrorText(error: unknown): string {
  const msg = String((error as { message?: string } | null)?.message ?? error ?? '');
  if (msg.includes('already_used')) return '이미 쓴 쿠폰이에요';
  if (msg.includes('expired')) return '기한이 지난 쿠폰이에요';
  if (msg.includes('not_partner')) return '지금은 쿠폰을 받을 수 없는 가게예요';
  if (msg.includes('not_yours')) return '내 쿠폰이 아니에요';
  return '연결을 확인하고 다시 눌러 주세요';
}

// ---- 현황판 (4-28)

export interface BoardTotals {
  claimed: number;
  redeemed: number;
  people: number;
}

export interface AdminBoard {
  days: number;
  totals: BoardTotals & { shops: number };
  shops: { id: number; name: string; claimed: number; redeemed: number; people: number; lastRedeemedAt: string | null }[];
  recent: {
    names: string;
    shop: string;
    menu: string | null;
    people: number;
    claimedAt: string;
    redeemedAt: string | null;
    source: 'session' | 'shop';
  }[];
  // 월요일부터 일요일
  dowClaimed: number[];
  dowRedeemed: number[];
  // 0시부터 23시(한국 시간)
  hourClaimed: number[];
  hourRedeemed: number[];
}

const int = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const ints = (v: unknown, n: number): number[] =>
  Array.from({ length: n }, (_, i) => (Array.isArray(v) ? int(v[i]) : 0));
const totals = (t: any): BoardTotals => ({ claimed: int(t?.claimed), redeemed: int(t?.redeemed), people: int(t?.people) });

// 운영자 현황판. 운영자가 아니면 서버가 not_admin을 던진다
// 운영자 현황판의 단과대별 쓴 쿠폰 (4-28, 0035). 5명 미만인 단과대와 고르지 않은 사람은 서버가 'other'(기타)로 묶는다
export type CollegeRow = { label: string; users: number; redeemed: number };

export function toCollegeRows(rows: readonly { college: string; users: number; redeemed: number }[]): CollegeRow[] {
  return rows.map((r) => ({
    label: r.college === 'other' ? '기타' : (collegeLabel(r.college) ?? '기타'),
    users: int(r.users),
    redeemed: int(r.redeemed),
  }));
}

export async function getAdminColleges(days: number, area: string | null, client: Client = getSupabase()): Promise<CollegeRow[]> {
  const { data, error } = await client.rpc('admin_coupon_colleges', { p_days: days, p_area: area });
  if (error) throw error;
  return toCollegeRows((data ?? []) as any[]);
}

export async function getAdminBoard(
  days: number,
  area: string | null,
  client: Client = getSupabase()
): Promise<AdminBoard> {
  const { data, error } = await client.rpc('admin_coupon_board', { p_days: days, p_area: area });
  if (error) throw error;
  const r = (data ?? {}) as any;
  return {
    days: int(r.days),
    totals: { ...totals(r.totals), shops: int(r.totals?.shops) },
    shops: (Array.isArray(r.shops) ? r.shops : []).map((s: any) => ({
      id: s.id,
      name: String(s.name ?? ''),
      claimed: int(s.claimed),
      redeemed: int(s.redeemed),
      people: int(s.people),
      lastRedeemedAt: str(s.last_redeemed_at),
    })),
    recent: (Array.isArray(r.recent) ? r.recent : []).map((x: any) => ({
      names: String(x.names ?? ''),
      shop: String(x.shop ?? ''),
      menu: str(x.menu),
      people: int(x.people),
      claimedAt: String(x.claimed_at),
      redeemedAt: str(x.redeemed_at),
      source: x.source === 'shop' ? 'shop' : 'session',
    })),
    dowClaimed: ints(r.dow_claimed, 7),
    dowRedeemed: ints(r.dow_redeemed, 7),
    hourClaimed: ints(r.hour_claimed, 24),
    hourRedeemed: ints(r.hour_redeemed, 24),
  };
}

export interface OwnerBoard {
  shop: { name: string; benefit: string | null; pinSet: boolean };
  week: BoardTotals;
  total: BoardTotals;
  // 분포를 보이는 최소 팀 수. 누적 팀이 이보다 적으면 아래 둘은 null
  minTeams: number;
  hourClaimed: number[] | null;
  hourRedeemed: number[] | null;
  menus: { name: string; teams: number }[] | null;
}

// 사장님 현황. 로그인 없이 토큰으로 읽는다. 이름은 오지 않는다
export async function getOwnerBoard(token: string, client: Client = getSupabase()): Promise<OwnerBoard> {
  const { data, error } = await client.rpc('owner_board', { p_token: token });
  if (error) throw error;
  const r = (data ?? {}) as any;
  return {
    shop: { name: String(r.shop?.name ?? ''), benefit: str(r.shop?.benefit), pinSet: Boolean(r.shop?.pin_set) },
    week: totals(r.week),
    total: totals(r.total),
    minTeams: int(r.min_teams),
    hourClaimed: Array.isArray(r.hour_claimed) ? ints(r.hour_claimed, 24) : null,
    hourRedeemed: Array.isArray(r.hour_redeemed) ? ints(r.hour_redeemed, 24) : null,
    menus: Array.isArray(r.menus)
      ? r.menus.map((m: any) => ({ name: String(m.name ?? ''), teams: int(m.teams) }))
      : null,
  };
}

// 사용률: 쓴 팀 ÷ 받은 팀. 받은 팀이 없으면 null(화면은 "-")
export function redeemRate(t: Pick<BoardTotals, 'claimed' | 'redeemed'>): number | null {
  return t.claimed > 0 ? Math.round((t.redeemed / t.claimed) * 100) : null;
}
