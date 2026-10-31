import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createGroup,
  type CreateGroupInput,
  type CreateGroupResult,
  getGroupDetail,
  getMyGroups,
  type Group,
  type GroupDetail,
  type Member,
  type RecentMeal,
  startSession,
} from '@/api/groups';
import {
  DISPLAY_NAME_MAX,
  GROUP_NAME_MAX,
  INVITE_CODE_LENGTH,
} from '@/constants';

export type {
  CreateGroupInput,
  CreateGroupResult,
  Group,
  GroupDetail,
  Member,
  RecentMeal,
};

// 4-2. 모임 만들기 사전 입력 검증 헬퍼
export function validateGroupInput(name: string, displayName: string): void {
  const trimmedName = name.trim();
  const trimmedDisplayName = displayName.trim();

  if (trimmedName.length === 0) {
    throw new Error('모임 이름을 입력해주세요.');
  }
  if (trimmedName.length > GROUP_NAME_MAX) {
    throw new Error(`모임 이름은 ${GROUP_NAME_MAX}자 이하여야 해요.`);
  }
  if (trimmedDisplayName.length === 0) {
    throw new Error('내 이름을 입력해주세요.');
  }
  if (trimmedDisplayName.length > DISPLAY_NAME_MAX) {
    throw new Error(`이름은 ${DISPLAY_NAME_MAX}자 이하여야 해요.`);
  }
}

// 4-4. 초대 코드 생성 헬퍼 (테스트 및 fallback용)
export function generateInviteCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// 4-3. 내 모임 목록 조회 훅 (최근에 들어간 순 정렬 반영)
export function useMyGroups() {
  const query = useQuery({
    queryKey: ['groups'],
    queryFn: () => getMyGroups(),
  });

  return {
    groups: query.data ?? [],
    isLoading: query.isPending,
    isError: query.isError,
    error: query.error,
    refetch: () => query.refetch(),
  };
}

// 4-2. 모임 만들기 훅 (서버 RPC create_group 연동)
export function useCreateGroup() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (input: CreateGroupInput): Promise<CreateGroupResult> => {
      // 1. 입력 검증
      if (input.displayName !== undefined && input.displayName !== null) {
        validateGroupInput(input.name, input.displayName);
      } else if (!input.name.trim()) {
        throw new Error('모임 이름을 입력해주세요.');
      }

      // 2. 서버 RPC 호출
      return await createGroup(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
  });

  return {
    createGroup: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}

// 4-6. 모임 상세 화면 데이터 조회 훅
export function useGroupDetail(groupId: string) {
  const query = useQuery({
    queryKey: ['groups', 'detail', groupId],
    queryFn: () => getGroupDetail(groupId),
    enabled: !!groupId,
  });

  return {
    group: query.data ?? null,
    isLoading: query.isPending,
    isError: query.isError,
    error: query.error,
    refetch: () => query.refetch(),
  };
}

// 4-6 & 4-8. 판 시작 / 진행 중인 판 참여 훅 (서버 RPC start_session 연동)
export function useStartSession(groupId: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (): Promise<string> => {
      return await startSession(groupId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups', 'detail', groupId] });
    },
  });

  return {
    startSession: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}
