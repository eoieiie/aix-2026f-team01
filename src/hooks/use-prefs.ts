import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getAvatarOptions, getMyPrefs, getVisibleAvatars, saveMyPrefs } from '@/api/prefs';

export { prefsErrorMessage } from '@/api/prefs';
export type { AvatarOption, MyPrefs } from '@/constants/prefs';

const PREFS_KEY = ['my-prefs'] as const;
const AVATAR_OPTIONS_KEY = ['avatar-options'] as const;
export const AVATARS_KEY = ['avatars'] as const;

// 내 아바타, 단과대, 취향 (4-27). 못 받아도 프로필 탭은 그대로 보인다
export function useMyPrefs(enabled = true) {
  const query = useQuery({ queryKey: PREFS_KEY, queryFn: () => getMyPrefs(), enabled, retry: false, staleTime: 0 });
  return { prefs: query.data ?? null, isLoading: query.isPending, isError: query.isError, refetch: () => query.refetch() };
}

// 내가 고를 수 있는 아바타와 열리는 레벨
export function useAvatarOptions(enabled = true) {
  const query = useQuery({
    queryKey: AVATAR_OPTIONS_KEY,
    queryFn: () => getAvatarOptions(),
    enabled,
    retry: false,
    staleTime: 0,
  });
  return { options: query.data ?? [], isLoading: query.isPending, refetch: () => query.refetch() };
}

// 저장하면 내 취향, 아바타 목록, 사람들 아바타 표, 판의 채우기 추천을 다시 읽는다
export function useSavePrefs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: Record<string, unknown>) => saveMyPrefs(patch),
    onSuccess: (saved) => {
      queryClient.setQueryData(PREFS_KEY, saved);
      queryClient.invalidateQueries({ queryKey: AVATAR_OPTIONS_KEY });
      queryClient.invalidateQueries({ queryKey: AVATARS_KEY });
      queryClient.invalidateQueries({ queryKey: ['session-food-hints'] });
    },
  });
}

// 사람 id → 아바타 음식 id. 화면 어디서 불러도 한 번만 읽는다
export function useAvatars(): Record<string, number> {
  const query = useQuery({
    queryKey: AVATARS_KEY,
    queryFn: () => getVisibleAvatars(),
    retry: false,
    staleTime: 60_000,
  });
  return query.data ?? {};
}
