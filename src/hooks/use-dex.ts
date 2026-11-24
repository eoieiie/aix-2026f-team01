import { useQuery } from '@tanstack/react-query';

import { getGroupTimeline, getMyFoodDex } from '@/api/dex';

// 4-25 음식 도감. 판이 끝나면 결과 화면도 이 값으로 "새 메뉴 모음!"을 판단한다
export function useFoodDex(enabled = true) {
  const query = useQuery({ queryKey: ['food-dex'], queryFn: () => getMyFoodDex(), enabled, staleTime: 0, retry: false });
  return { dex: query.data ?? null, isLoading: query.isPending, isError: query.isError, refetch: () => query.refetch() };
}

export function useGroupTimeline(groupId: string) {
  const query = useQuery({
    queryKey: ['group-timeline', groupId],
    queryFn: () => getGroupTimeline(groupId),
    enabled: !!groupId,
    retry: false,
  });
  return { meals: query.data ?? null, isError: query.isError };
}
