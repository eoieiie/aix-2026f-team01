import { useQuery } from '@tanstack/react-query';

import { ensureAnonymousSession } from '@/api/auth';

export type AuthStatus = 'loading' | 'ready' | 'error';

// 화면은 이 훅으로만 로그인 상태를 본다
export function useAnonymousAuth() {
  const query = useQuery({
    queryKey: ['auth', 'session'],
    queryFn: () => ensureAnonymousSession(),
    // 실패하면 바로 "연결할 수 없어요"를 보여주고, 다시 시도는 사람이 누른다
    retry: false,
    staleTime: Infinity,
  });

  if (query.error) console.error('[auth] 익명 로그인 실패', query.error);

  const status: AuthStatus = query.isPending
    ? 'loading'
    : query.isError
      ? 'error'
      : 'ready';

  return {
    status,
    userId: query.data ?? null,
    retrying: query.isFetching,
    retry: () => query.refetch(),
  };
}
