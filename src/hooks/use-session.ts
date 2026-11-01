import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import {
  addCandidate,
  castVote,
  getSession,
  getVoteCounts,
  joinSession,
  listFoods,
  openVoting,
  removeCandidate,
  setPitch,
  spinRoulette,
  subscribeSession,
} from '@/api/sessions';

export type {
  Candidate,
  Food,
  Participant,
  SessionStatus,
  SessionView,
  VoteCount,
} from '@/api/sessions';
export { rouletteSlices, searchFoods, sessionErrorMessage, SessionError } from '@/api/sessions';

const sessionKey = (id: string) => ['session', id] as const;

// 판 화면의 데이터. 들어오면 참여자가 되고(4-8), 다른 기기의 변경은 실시간으로 받아 통째로 다시 읽는다
export function useSession(sessionId: string) {
  const queryClient = useQueryClient();

  const join = useQuery({
    queryKey: ['session-join', sessionId],
    queryFn: () => joinSession(sessionId),
    enabled: !!sessionId,
    retry: false,
    staleTime: Infinity,
  });

  const session = useQuery({
    queryKey: sessionKey(sessionId),
    queryFn: () => getSession(sessionId),
    enabled: join.isSuccess,
    retry: false,
    // 실시간이 끊겨도 10초마다 한 번은 맞춘다
    refetchInterval: 10_000,
  });

  useEffect(() => {
    if (!join.isSuccess) return;
    return subscribeSession(sessionId, () => {
      queryClient.invalidateQueries({ queryKey: sessionKey(sessionId) });
    });
  }, [join.isSuccess, queryClient, sessionId]);

  const error = join.error ?? session.error;
  return {
    session: session.data,
    isLoading: join.isPending || (join.isSuccess && session.isPending),
    error,
    retry: () => (join.isError ? join.refetch() : session.refetch()),
  };
}

// 음식 목록은 판이 바뀌어도 같으므로 한 번만 읽는다
export function useFoods() {
  const query = useQuery({ queryKey: ['foods'], queryFn: () => listFoods(), staleTime: Infinity });
  return { foods: query.data ?? [], isLoading: query.isPending };
}

// 끝난 판에서만 표 수를 받는다. 결과가 나오기 전에는 부르지 않는다 (4-12)
export function useVoteCounts(sessionId: string, done: boolean) {
  const query = useQuery({
    queryKey: ['session-counts', sessionId],
    queryFn: () => getVoteCounts(sessionId),
    enabled: done,
    staleTime: Infinity,
  });
  return { counts: query.data, error: query.error };
}

// 판에서 누르는 버튼들. 성공하면 판을 다시 읽어 내 화면도 바로 바뀐다
export function useSessionActions(sessionId: string) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: sessionKey(sessionId) });

  const add = useMutation({
    mutationFn: (foodId: number) => addCandidate(sessionId, foodId),
    onSettled: refresh,
  });
  const pitch = useMutation({
    mutationFn: ({ foodId, text }: { foodId: number; text: string }) =>
      setPitch(sessionId, foodId, text),
    onSettled: refresh,
  });
  const remove = useMutation({
    mutationFn: (foodId: number) => removeCandidate(sessionId, foodId),
    onSettled: refresh,
  });
  const open = useMutation({ mutationFn: () => openVoting(sessionId), onSettled: refresh });
  const vote = useMutation({
    mutationFn: (foodId: number) => castVote(sessionId, foodId),
    onSettled: refresh,
  });
  const spin = useMutation({ mutationFn: () => spinRoulette(sessionId), onSettled: refresh });

  return { add, pitch, remove, open, vote, spin };
}
