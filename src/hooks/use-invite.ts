import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getInviteInfo, InviteError, joinGroup, withRo } from '@/api/invite';

export { withRo };

// 초대 링크 화면이 쓰는 훅 (spec.md 4-5). 화면은 Supabase를 직접 부르지 않는다

// 오류를 화면에 보일 방식으로 나눈다. 문구가 정해진 코드가 아니면 다시 시도 버튼을 보인다
export function inviteErrorCode(error: unknown): string | null {
  return error instanceof InviteError ? error.code : null;
}

export function useInvite(code: string) {
  const query = useQuery({
    queryKey: ['invite', code],
    queryFn: () => getInviteInfo(code),
    enabled: !!code,
    // 없는 코드를 여러 번 물어보지 않는다. 네트워크 오류도 사람이 다시 시도를 누른다
    retry: false,
  });

  return {
    invite: query.data ?? null,
    isLoading: query.isPending,
    error: query.error,
    retrying: query.isFetching,
    refetch: () => query.refetch(),
  };
}

export function useJoinGroup(code: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    // displayName이 null이면 서버가 프로필 이름을 쓴다
    mutationFn: (displayName: string | null) => joinGroup(code, displayName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
  });

  return {
    join: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}
