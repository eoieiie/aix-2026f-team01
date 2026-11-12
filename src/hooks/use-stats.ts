import { useQuery } from '@tanstack/react-query';

import { getMyStats } from '@/api/stats';

export type { Companion, FoodCount, MyProfile, MyStats } from '@/api/stats';
export { authorityTitle, levelOf, typeLetters } from '@/api/stats';

// 내 프로필 숫자 (4-15). 탭에 들어올 때마다 새로 읽는다
export function useMyStats() {
  const query = useQuery({ queryKey: ['my-stats'], queryFn: () => getMyStats(), staleTime: 0 });
  return {
    stats: query.data,
    isLoading: query.isPending,
    isError: query.isError,
    refetch: () => query.refetch(),
  };
}
