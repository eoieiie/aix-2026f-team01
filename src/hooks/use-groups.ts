import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  DISPLAY_NAME_MAX,
  GROUP_NAME_MAX,
  INVITE_CODE_LENGTH,
  RECENT_MEALS_LIMIT,
} from '@/constants';

export interface Group {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
  last_visited_at: string;
}

export interface Member {
  user_id: string;
  display_name: string;
  joined_at: string;
}

export interface RecentMeal {
  id: string;
  food_id: number;
  food_name: string;
  eaten_at: string;
}

export interface GroupDetail {
  id: string;
  name: string;
  invite_code: string;
  is_member: boolean;
  open_session_id: string | null;
  members: Member[];
  recent_meals: RecentMeal[];
}

export interface CreateGroupInput {
  name: string;
  displayName: string;
}

// B(서버 함수) 연결 전 가짜 데이터 저장소
// spec.md: "가짜 데이터는 화면 파일이 아니라 src/hooks/에 둔다. B가 연결되면 훅만 바꾸면 된다."
const initialGroups: Group[] = [
  {
    id: 'grp-demo-1',
    name: '점심 팟',
    invite_code: 'AB3K9P',
    created_at: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
    last_visited_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'grp-demo-2',
    name: '금요 미식회',
    invite_code: 'XY7M2R',
    created_at: new Date(Date.now() - 3600000 * 24 * 5).toISOString(),
    last_visited_at: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
];

const initialMembers: Record<string, Member[]> = {
  'grp-demo-1': [
    { user_id: 'user-1', display_name: '재곤', joined_at: new Date().toISOString() },
    { user_id: 'user-2', display_name: '병주', joined_at: new Date().toISOString() },
    { user_id: 'user-3', display_name: '혁준', joined_at: new Date().toISOString() },
    { user_id: 'user-4', display_name: '학준', joined_at: new Date().toISOString() },
  ],
  'grp-demo-2': [
    { user_id: 'user-1', display_name: '재곤', joined_at: new Date().toISOString() },
    { user_id: 'user-2', display_name: '병주', joined_at: new Date().toISOString() },
  ],
};

const initialMeals: Record<string, RecentMeal[]> = {
  'grp-demo-1': [
    { id: 'meal-1', food_id: 1, food_name: '김치찌개', eaten_at: '2026-10-27T12:30:00Z' },
    { id: 'meal-2', food_id: 2, food_name: '비빔밥', eaten_at: '2026-10-26T12:20:00Z' },
    { id: 'meal-3', food_id: 3, food_name: '돈까스', eaten_at: '2026-10-25T13:00:00Z' },
    { id: 'meal-4', food_id: 4, food_name: '마라탕', eaten_at: '2026-10-24T18:40:00Z' },
    { id: 'meal-5', food_id: 5, food_name: '쌀국수', eaten_at: '2026-10-23T12:15:00Z' },
  ],
  'grp-demo-2': [
    { id: 'meal-6', food_id: 6, food_name: '초밥', eaten_at: '2026-10-20T19:00:00Z' },
  ],
};

// 진행 중인 세션 유무 목업
const initialOpenSessions: Record<string, string | null> = {
  'grp-demo-1': 'session-open-1',
  'grp-demo-2': null,
};

let memoryGroups: Group[] = [...initialGroups];
const memoryMembers: Record<string, Member[]> = { ...initialMembers };
const memoryMeals: Record<string, RecentMeal[]> = { ...initialMeals };
const memoryOpenSessions: Record<string, string | null> = { ...initialOpenSessions };

// 헷갈리는 0, O, 1, I 제외 6자 코드 생성 (spec.md 4-2)
export function generateInviteCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function validateGroupInput(name: string, displayName: string): void {
  const trimmedName = name.trim();
  const trimmedDisplayName = displayName.trim();

  if (!trimmedName) {
    throw new Error('모임 이름을 입력해주세요.');
  }
  if (trimmedName.length > GROUP_NAME_MAX) {
    throw new Error(`모임 이름은 ${GROUP_NAME_MAX}자 이하여야 해요.`);
  }
  if (!trimmedDisplayName) {
    throw new Error('내 이름을 입력해주세요.');
  }
  if (trimmedDisplayName.length > DISPLAY_NAME_MAX) {
    throw new Error(`이름은 ${DISPLAY_NAME_MAX}자 이하여야 해요.`);
  }
}

// 4-3 내 모임 목록 (최근에 들어간 순으로 정렬)
export function useMyGroups() {
  const query = useQuery({
    queryKey: ['groups', 'my'],
    queryFn: async (): Promise<Group[]> => {
      // 최근 들어간 순 정렬
      return [...memoryGroups].sort(
        (a, b) => new Date(b.last_visited_at).getTime() - new Date(a.last_visited_at).getTime()
      );
    },
  });

  return {
    groups: query.data ?? [],
    isLoading: query.isPending,
    isError: query.isError,
    error: query.error,
    refetch: () => query.refetch(),
  };
}

// 4-2 모임 만들기
export function useCreateGroup() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (input: CreateGroupInput): Promise<{ group_id: string; invite_code: string }> => {
      const trimmedName = input.name.trim();
      const trimmedDisplayName = input.displayName.trim();

      if (!trimmedName) {
        throw new Error('모임 이름을 입력해주세요.');
      }
      if (trimmedName.length > GROUP_NAME_MAX) {
        throw new Error(`모임 이름은 ${GROUP_NAME_MAX}자 이하여야 해요.`);
      }
      if (!trimmedDisplayName) {
        throw new Error('내 이름을 입력해주세요.');
      }
      if (trimmedDisplayName.length > DISPLAY_NAME_MAX) {
        throw new Error(`이름은 ${DISPLAY_NAME_MAX}자 이하여야 해요.`);
      }

      const newId = `grp-${Date.now()}`;
      const code = generateInviteCode();
      const now = new Date().toISOString();

      const newGroup: Group = {
        id: newId,
        name: trimmedName,
        invite_code: code,
        created_at: now,
        last_visited_at: now,
      };

      memoryGroups.unshift(newGroup);
      memoryMembers[newId] = [
        {
          user_id: 'user-me',
          display_name: trimmedDisplayName,
          joined_at: now,
        },
      ];
      memoryMeals[newId] = [];
      memoryOpenSessions[newId] = null;

      return { group_id: newId, invite_code: code };
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

// 4-6 모임 화면 데이터 조회
export function useGroupDetail(groupId: string) {
  const query = useQuery({
    queryKey: ['groups', 'detail', groupId],
    queryFn: async (): Promise<GroupDetail> => {
      const found = memoryGroups.find((g) => g.id === groupId);
      if (!found) {
        // 소속이 아니거나 없는 모임
        return {
          id: groupId,
          name: '',
          invite_code: '',
          is_member: false,
          open_session_id: null,
          members: [],
          recent_meals: [],
        };
      }

      // 방문 시간 갱신 (최근에 들어간 순 정렬 반영)
      found.last_visited_at = new Date().toISOString();

      const members = memoryMembers[groupId] ?? [];
      const meals = (memoryMeals[groupId] ?? []).slice(0, RECENT_MEALS_LIMIT);
      const openSessionId = memoryOpenSessions[groupId] ?? null;

      return {
        id: found.id,
        name: found.name,
        invite_code: found.invite_code,
        is_member: true,
        open_session_id: openSessionId,
        members,
        recent_meals: meals,
      };
    },
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

// 테스트용 메모리 초기화 함수
export function _resetMemoryGroups(customGroups?: Group[]) {
  memoryGroups = customGroups ? [...customGroups] : [...initialGroups];
}
