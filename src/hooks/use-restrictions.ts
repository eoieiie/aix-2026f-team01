import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  getMyRestrictions,
  type RestrictionItem,
  saveMyRestrictions,
} from '@/api/restrictions';

export type { RestrictionItem } from '@/api/restrictions';
export {
  itemKey,
  restrictionErrorMessage,
  setItemKind,
  toggleItem,
} from '@/api/restrictions';

// 못 먹는 것 화면이 쓰는 훅 (spec.md 4-7). 화면은 Supabase를 직접 부르지 않는다

export function useMyRestrictions() {
  const query = useQuery({
    queryKey: ['restrictions', 'my'],
    queryFn: () => getMyRestrictions(),
    retry: false,
  });

  return {
    restrictions: query.data,
    isLoading: query.isPending,
    error: query.error,
    retrying: query.isFetching,
    refetch: () => query.refetch(),
  };
}

export function useSaveRestrictions() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (items: RestrictionItem[]) => saveMyRestrictions(items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restrictions'] });
      // 서버가 진행 중인 판의 후보를 다시 판정했으니, 돌아갈 판 화면도 다시 읽는다
      queryClient.invalidateQueries({ queryKey: ['session'] });
    },
  });

  return {
    save: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}
