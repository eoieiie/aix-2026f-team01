import { useQuery } from '@tanstack/react-query';

import { getCouncilBenefits } from '@/api/council-benefits';
import { useMyPrefs } from '@/hooks/use-prefs';

export { benefitLines, councilBadge, councilMapLinks, councilShopRows } from '@/api/council-benefits';
export type { CouncilBenefit } from '@/api/council-benefits';

export function useCouncilBenefits() {
  const prefs = useMyPrefs();
  const college = prefs.prefs?.college ?? null;
  const query = useQuery({
    queryKey: ['council-benefits', college],
    queryFn: () => getCouncilBenefits(college),
    staleTime: 60_000,
    retry: false,
    enabled: !prefs.isLoading,
  });
  return { ...query, college, benefits: query.data ?? [] };
}
