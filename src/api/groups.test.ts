import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  createGroup,
  getGroupDetail,
  getMyGroups,
  getMyProfileName,
  GroupError,
  plateFoodsFromMeals,
  startSession,
} from './groups';

function fakeClient(opts: {
  rpcData?: unknown;
  rpcError?: { message: string };
  userId?: string | null;
  fromData?: Record<string, any>;
}) {
  const rpc = jest.fn(async (_fn: string, _args: any) => ({
    data: opts.rpcData ?? null,
    error: opts.rpcError ?? null,
  }));

  const from = jest.fn((table: string) => {
    const tableData = opts.fromData?.[table];
    return {
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          maybeSingle: jest.fn(async () => ({
            data: tableData?.maybeSingle ?? null,
            error: null,
          })),
          neq: jest.fn(() => ({
            maybeSingle: jest.fn(async () => ({
              data: tableData?.openSession ?? null,
              error: null,
            })),
          })),
          order: jest.fn(() => ({
            limit: jest.fn(async () => ({
              data: tableData?.list ?? [],
              error: null,
            })),
          })),
          data: tableData?.list ?? [],
          error: null,
        })),
      })),
    };
  });

  const getSession = jest.fn(async () => ({
    data: {
      session: opts.userId === null ? null : { user: { id: opts.userId ?? 'user-me' } },
    },
    error: null,
  }));

  return { client: { rpc, from, auth: { getSession } } as any, rpc, from };
}

describe('src/api/groups.ts 테스트', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  describe('createGroup (spec.md 4-2)', () => {
    it('모임 이름과 내 이름을 전달하면 생성된 id와 초대 코드를 돌려준다', async () => {
      const { client, rpc } = fakeClient({
        rpcData: [{ group_id: 'grp-123', invite_code: 'AB3K9P' }],
      });

      const res = await createGroup({ name: '점심 팟', displayName: '홍길동' }, client);
      expect(res).toEqual({ group_id: 'grp-123', invite_code: 'AB3K9P' });
      expect(rpc).toHaveBeenCalledWith('create_group', {
        p_name: '점심 팟',
        p_display_name: '홍길동',
      });
    });

    it('이름이 비어 있으면 GroupError(name_empty)를 던진다', async () => {
      const { client } = fakeClient({ rpcError: { message: 'name_empty' } });
      const err = await createGroup({ name: '', displayName: '홍길동' }, client).catch((e) => e);
      expect(err).toBeInstanceOf(GroupError);
      expect(err.message).toBe('이름을 입력해주세요');
    });

    it('이름이 너무 길면 GroupError(name_too_long)를 던진다', async () => {
      const { client } = fakeClient({ rpcError: { message: 'name_too_long' } });
      await expect(createGroup({ name: '길다', displayName: '홍길동' }, client)).rejects.toThrow(
        '이름이 너무 길어요'
      );
    });
  });

  describe('getMyGroups (spec.md 4-3)', () => {
    it('로그인 세션이 없으면 빈 배열을 돌려준다', async () => {
      const { client } = fakeClient({ userId: null });
      const res = await getMyGroups(client);
      expect(res).toEqual([]);
    });

    it('모임 목록을 가져와 반환한다', async () => {
      const { client } = fakeClient({
        userId: 'user-me',
        fromData: {
          memberships: {
            list: [
              {
                group_id: 'g1',
                joined_at: '2026-10-01T00:00:00Z',
                groups: {
                  id: 'g1',
                  name: '점심 팟',
                  invite_code: 'AB3K9P',
                  created_at: '2026-10-01T00:00:00Z',
                },
              },
            ],
          },
        },
      });

      const res = await getMyGroups(client);
      expect(res).toHaveLength(1);
      expect(res[0].name).toBe('점심 팟');
      expect(res[0].members).toEqual([]);
      expect(res[0].recent_foods).toEqual([]);
      expect(res[0].has_open_session).toBe(false);
    });

    it('카드에 쓸 멤버 이름(들어온 순), 최근 먹은 것 세 개(최근 순), 진행 중인 판을 같이 준다', async () => {
      const { client } = fakeClient({
        userId: 'user-me',
        fromData: {
          memberships: {
            list: [
              {
                group_id: 'g1',
                joined_at: '2026-10-01T00:00:00Z',
                groups: {
                  id: 'g1',
                  name: '점심 팟',
                  invite_code: 'AB3K9P',
                  created_at: '2026-10-01T00:00:00Z',
                  members: [
                    { display_name: '준호', joined_at: '2026-10-02T00:00:00Z' },
                    { display_name: '민지', joined_at: '2026-10-01T00:00:00Z' },
                  ],
                  sessions: [{ status: 'done' }, { status: 'voting' }],
                  meals: [
                    {
                      food_id: 1,
                      eaten_at: '2026-10-03T00:00:00Z',
                      foods: { name: '김치찌개' },
                    },
                    {
                      food_id: 2,
                      eaten_at: '2026-10-06T00:00:00Z',
                      foods: { name: '비빔밥' },
                    },
                    {
                      food_id: 3,
                      eaten_at: '2026-10-05T00:00:00Z',
                      foods: { name: '쌀국수' },
                    },
                    {
                      food_id: 4,
                      eaten_at: '2026-10-04T00:00:00Z',
                      foods: { name: '불고기' },
                    },
                  ],
                },
              },
            ],
          },
        },
      });

      const [group] = await getMyGroups(client);
      expect(group.members).toEqual(['민지', '준호']);
      expect(group.recent_foods.map((f) => f.food_name)).toEqual(['비빔밥', '쌀국수', '불고기']);
      expect(group.has_open_session).toBe(true);
      // 서버 함수가 없을 때(rpc가 빈 값)는 같은 식사 기록으로 먹은 음식 줄을 만든다
      expect(group.plate_foods.map((f) => f.name)).toEqual(['비빔밥', '쌀국수', '불고기', '김치찌개']);
    });

    it('먹은 음식 줄은 서버 함수(home_group_foods)의 모임별 값을 쓰고 그림 주소를 만든다 (0053)', async () => {
      const prev = process.env.EXPO_PUBLIC_SUPABASE_URL;
      process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://x.supabase.co';
      const { client, rpc } = fakeClient({
        userId: 'user-me',
        rpcData: [
          {
            group_id: 'g1',
            foods: [
              { food_id: 7, name: '마라탕', image_path: '7.webp' },
              { food_id: 900, name: '찌개찌개', image_path: null },
            ],
          },
          { group_id: 'g2', foods: [{ food_id: 8, name: '남의 모임 음식', image_path: '8.webp' }] },
        ],
        fromData: {
          memberships: {
            list: [
              {
                group_id: 'g1',
                joined_at: '2026-10-01T00:00:00Z',
                groups: {
                  id: 'g1',
                  name: '점심 팟',
                  invite_code: 'AB3K9P',
                  created_at: '2026-10-01T00:00:00Z',
                  meals: [{ food_id: 1, eaten_at: '2026-10-03T00:00:00Z', foods: { name: '김치찌개' } }],
                },
              },
            ],
          },
        },
      });
      const [group] = await getMyGroups(client);
      process.env.EXPO_PUBLIC_SUPABASE_URL = prev;
      expect(rpc).toHaveBeenCalledWith('home_group_foods');
      expect(group.plate_foods).toEqual([
        { food_id: 7, name: '마라탕', image_url: 'https://x.supabase.co/storage/v1/object/public/food-images/7.webp' },
        { food_id: 900, name: '찌개찌개', image_url: null },
      ]);
    });
  });

  describe('plateFoodsFromMeals', () => {
    it('같은 음식은 한 번, 최대 4개', () => {
      const meals = [1, 2, 1, 3, 4, 5].map((id) => ({ food_id: id, foods: { name: `음식${id}` } }));
      expect(plateFoodsFromMeals(meals).map((f) => f.food_id)).toEqual([1, 2, 3, 4]);
    });
  });

  describe('getGroupDetail (spec.md 4-6)', () => {
    it('모임이 없거나 소속이 아니면 is_member: false를 돌려준다', async () => {
      const { client } = fakeClient({
        userId: 'user-other',
        fromData: {
          groups: { maybeSingle: null },
        },
      });

      const detail = await getGroupDetail('g-unknown', client);
      expect(detail.is_member).toBe(false);
      expect(detail.members).toEqual([]);
    });

    it('모임과 멤버, 최근 식사를 올바르게 가져온다', async () => {
      const { client } = fakeClient({
        userId: 'user-me',
        fromData: {
          groups: {
            maybeSingle: {
              id: 'g1',
              name: '점심 팟',
              invite_code: 'AB3K9P',
              created_at: '2026-10-01T00:00:00Z',
            },
          },
          memberships: {
            list: [
              {
                user_id: 'user-me',
                display_name: '재곤',
                joined_at: '2026-10-01T00:00:00Z',
              },
            ],
          },
          sessions: {
            openSession: { id: 's1' },
          },
          meals: {
            list: [
              {
                id: 'm1',
                food_id: 1,
                eaten_at: '2026-10-29T12:00:00Z',
                foods: { name: '비빔밥' },
              },
            ],
          },
        },
      });

      const detail = await getGroupDetail('g1', client);
      expect(detail.is_member).toBe(true);
      expect(detail.name).toBe('점심 팟');
      expect(detail.open_session_id).toBe('s1');
      expect(detail.members).toHaveLength(1);
      expect(detail.recent_meals).toHaveLength(1);
      expect(detail.recent_meals[0].food_name).toBe('비빔밥');
    });
  });

  describe('startSession (spec.md 4-6, 4-8)', () => {
    it('RPC start_session을 호출해 세션 ID를 돌려준다', async () => {
      const { client, rpc } = fakeClient({ rpcData: 'sess-999' });
      const res = await startSession('g1', undefined, client);
      expect(res).toBe('sess-999');
      expect(rpc).toHaveBeenCalledWith('start_session', { p_group_id: 'g1' });
    });

    it('멤버가 아니면 GroupError(not_member)를 던진다', async () => {
      const { client } = fakeClient({ rpcError: { message: 'not_member' } });
      await expect(startSession('g1', undefined, client)).rejects.toThrow('이 모임 멤버가 아니에요');
    });
  });
  describe('getMyProfileName (4-2 프로필 이름이 있으면 묻지 않음)', () => {
    it('프로필 이름이 있으면 그 이름을 돌려준다', async () => {
      const { client } = fakeClient({ fromData: { profiles: { maybeSingle: { display_name: '병주' } } } });
      await expect(getMyProfileName(client)).resolves.toBe('병주');
    });

    it('프로필이 없으면 null이라 창에서 이름을 묻는다', async () => {
      const { client } = fakeClient({
        fromData: { profiles: { maybeSingle: null } },
      });
      await expect(getMyProfileName(client)).resolves.toBeNull();
    });

    it('로그인 전이면 null', async () => {
      const { client } = fakeClient({ userId: null });
      await expect(getMyProfileName(client)).resolves.toBeNull();
    });
  });
});
