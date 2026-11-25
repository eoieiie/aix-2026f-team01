import { collegeLabel, type CollegeKey } from '@/constants/prefs';
import { getSupabase } from './supabase';
import type { Shop, ShopKind } from './shops';


export type CouncilBenefit = {
  id: number;
  college: CollegeKey | 'all';
  council_name: string;
  shop_name: string | null;
  restaurant_id: number | null;
  benefit: string | null;
  conditions: string | null;
  period: string | null;
  location: string | null;
  source_url: string;
  checked_on: string;
  status: 'notice' | 'list_only' | 'source_only';
};

export function councilBadge(college: CouncilBenefit['college']) {
  if (college === 'all') return '총학생회 제휴';
  if (college === 'computing') return '소융대 제휴';
  if (college === 'atc') return '첨융대 제휴';
  return `${collegeLabel(college)} 제휴`;
}

export async function getCouncilBenefits(college: CollegeKey | null): Promise<CouncilBenefit[]> {
  const { data, error } = await getSupabase()
    .from('council_benefits')
    .select('id,college,council_name,shop_name,restaurant_id,benefit,conditions,period,location,source_url,checked_on,status')
    .in('college', college ? [college, 'all'] : ['all'])
    .eq('show_in_app', true)
    .order('id');
  if (error) throw error;
  return data ?? [];
}

// 연결된 가게는 가까운 순서로, 지도 좌표나 연결이 없는 곳은 그 뒤로 보낸다.
export function councilShopRows(entries: readonly CouncilBenefit[], shops: readonly Shop[], kind: ShopKind, query: string) {
  const byId = new Map(shops.map((shop) => [shop.id, shop]));
  const clean = (text: string) => text.replace(/\s+/g, '').toLowerCase();
  const q = clean(query);
  const distance = (shop?: Shop) => shop?.lat == null || shop.lng == null
    ? Infinity
    : Math.hypot(shop.lat - 37.2998, (shop.lng - 126.8369) * Math.cos(37.2998 * Math.PI / 180));
  return entries
    .map((entry) => ({ entry, shop: byId.get(entry.restaurant_id ?? 0) }))
    .filter(({ entry, shop }) =>
      (kind === 'all' || (shop && (kind === 'partner' ? shop.partner : kind === shop.cuisine))) &&
      [entry.shop_name ?? '', shop?.name ?? '', ...(shop?.menus ?? [])].some((name) => clean(name).includes(q)))
    .sort((a, b) => Number(!a.shop) - Number(!b.shop) || distance(a.shop) - distance(b.shop) || a.entry.id - b.entry.id);
}

export function councilMapLinks(name: string, location: string | null) {
  const query = encodeURIComponent(location ? `${name} ${location}` : `안산 ${name}`);
  return { naver: `https://map.naver.com/p/search/${query}`, kakao: `https://map.kakao.com/?q=${query}` };
}
