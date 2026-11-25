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

// 혜택 원문을 목록과 결과 줄에 보일 줄들로 (4-29, 2026-11-25 병주 "저렇게 잘리는 부분 없으면 좋겠음").
// 말줄임 없이 항목마다 한 줄: 줄 앞 번호("1.", "2)", "-")를 떼고, 빈 줄과 괄호만 있는 안내 줄("(중복 불가)")은 뺀다.
// "or"만 있는 줄은 다음 항목 앞에 붙인다. 가게 상세는 원문 전부를 보인다(CouncilRecord)
export function benefitLines(text: string | null | undefined): string[] {
  if (!text) return [];
  const out: string[] = [];
  let joiner = '';
  for (const raw of text.split(/\r?\n/)) {
    const l = raw.trim().replace(/^(?:\d+\s*[.)]|[-\u2022\u00B7*])\s*/, '').trim();
    if (l === '' || /^\(.*\)$/.test(l)) continue;
    if (/^(or|또는)$/i.test(l)) {
      joiner = l + ' ';
      continue;
    }
    out.push(joiner + l);
    joiner = '';
  }
  return out;
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
      [entry.shop_name ?? '', shop?.name ?? '', ...(shop?.menus ?? []), ...(shop?.menusGuess ?? [])].some((name) => clean(name).includes(q)))
    .sort((a, b) => Number(!a.shop) - Number(!b.shop) || distance(a.shop) - distance(b.shop) || a.entry.id - b.entry.id);
}

export function councilMapLinks(name: string, location: string | null) {
  const query = encodeURIComponent(location ? `${name} ${location}` : `안산 ${name}`);
  return { naver: `https://map.naver.com/p/search/${query}`, kakao: `https://map.kakao.com/?q=${query}` };
}
