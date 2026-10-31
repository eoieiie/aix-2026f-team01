import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  createGroup,
  getGroupDetail,
  getMyGroups,
  GroupError,
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
    data: { session: opts.userId === null ? null : { user: { id: opts.userId ?? 'user-me' } } },
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
            list: [{ user_id: 'user-me', display_name: '재곤', joined_at: '2026-10-01T00:00:00Z' }],
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
      const res = await startSession('g1', client);
      expect(res).toBe('sess-999');
      expect(rpc).toHaveBeenCalledWith('start_session', { p_group_id: 'g1' });
    });

    it('멤버가 아니면 GroupError(not_member)를 던진다', async () => {
      const { client } = fakeClient({ rpcError: { message: 'not_member' } });
      await expect(startSession('g1', client)).rejects.toThrow('이 모임 멤버가 아니에요');
    });
  });
});
