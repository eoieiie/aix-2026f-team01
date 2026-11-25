import { collegeLabel, type CollegeKey } from '@/constants/prefs';
import { getSupabase } from './supabase';

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
    .neq('status', 'closed')
    .order('id');
  if (error) throw error;
  return data ?? [];
}
