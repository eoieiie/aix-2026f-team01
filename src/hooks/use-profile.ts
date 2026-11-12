import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getMyProfile, type SaveProfileInput, saveMyProfile } from '@/api/profile';

export type { Axes, MyProfile } from '@/api/profile';
export { profileErrorMessage, isValidHandle, typeCode, typeLines } from '@/api/profile';

export const MY_PROFILE_KEY = ['profile', 'me'] as const;

// 내 프로필. 없으면 null (아직 이름도 적지 않은 새 사람)
export function useMyProfile(enabled = true) {
  const query = useQuery({
    queryKey: MY_PROFILE_KEY,
    queryFn: () => getMyProfile(),
    enabled,
  });
  return query;
}

// 저장하면 프로필을 쓰는 화면(모임 만들기의 이름, 내 프로필)이 다시 읽는다
export function useSaveProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveProfileInput) => saveMyProfile(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile'] }),
  });
}
