import { getInviteInfo, InviteError, joinGroup, withRo } from './invite';

// 실제 서버 대신 rpc, from, auth만 흉내 내는 가짜 클라이언트
function fakeClient(opts: {
  rpcData?: unknown;
  rpcError?: { message: string };
  userId?: string | null;
  profileName?: string | null;
}) {
  const rpc = jest.fn(async () => ({ data: opts.rpcData ?? null, error: opts.rpcError ?? null }));
  const maybeSingle = jest.fn(async () => ({
    data: opts.profileName ? { display_name: opts.profileName } : null,
    error: null,
  }));
  const from = jest.fn(() => ({
    select: () => ({ eq: () => ({ maybeSingle }) }),
  }));
  const getSession = jest.fn(async () => ({
    data: { session: opts.userId === null ? null : { user: { id: opts.userId ?? 'me' } } },
    error: null,
  }));
  return { client: { rpc, from, auth: { getSession } } as any, rpc };
}

describe('getInviteInfo (spec.md 4-5)', () => {
  it('모임 이름, 소속 여부, 프로필 이름을 돌려준다', async () => {
    const { client, rpc } = fakeClient({
      rpcData: [{ group_id: 'g1', name: '점심 팟', is_member: false }],
      profileName: '하늘',
    });
    await expect(getInviteInfo('AB3K9P', client)).resolves.toEqual({
      groupId: 'g1',
      groupName: '점심 팟',
      isMember: false,
      profileName: '하늘',
    });
    expect(rpc).toHaveBeenCalledWith('get_group_by_code', { p_code: 'AB3K9P' });
  });

  it('프로필이 없으면 profileName은 null이다 (화면이 이름을 묻는다)', async () => {
    const { client } = fakeClient({
      rpcData: [{ group_id: 'g1', name: '점심 팟', is_member: false }],
    });
    await expect(getInviteInfo('AB3K9P', client)).resolves.toMatchObject({ profileName: null });
  });

  it('없는 코드면 "모임을 찾을 수 없어요"', async () => {
    const { client } = fakeClient({ rpcError: { message: 'group_not_found' } });
    const err = await getInviteInfo('ZZZZZZ', client).catch((e) => e);
    expect(err).toBeInstanceOf(InviteError);
    expect(err.code).toBe('group_not_found');
    expect(err.message).toBe('모임을 찾을 수 없어요');
  });

  it('문구가 없는 오류(네트워크 등)는 InviteError로 바꾸지 않는다 (화면은 다시 시도 버튼)', async () => {
    const { client } = fakeClient({ rpcError: { message: 'TypeError: Failed to fetch' } });
    const err = await getInviteInfo('AB3K9P', client).catch((e) => e);
    expect(err).not.toBeInstanceOf(InviteError);
  });
});

describe('joinGroup (spec.md 4-5)', () => {
  it('진행 중인 판이 있으면 그 id를 돌려준다', async () => {
    const { client, rpc } = fakeClient({
      rpcData: [{ group_id: 'g1', open_session_id: 's1' }],
    });
    await expect(joinGroup('AB3K9P', '하늘', client)).resolves.toEqual({
      groupId: 'g1',
      openSessionId: 's1',
    });
    expect(rpc).toHaveBeenCalledWith('join_group', { p_code: 'AB3K9P', p_display_name: '하늘' });
  });

  it('진행 중인 판이 없으면 openSessionId는 null이다', async () => {
    const { client } = fakeClient({ rpcData: [{ group_id: 'g1', open_session_id: null }] });
    await expect(joinGroup('AB3K9P', null, client)).resolves.toEqual({
      groupId: 'g1',
      openSessionId: null,
    });
  });

  it('같은 이름이 있으면 "이미 있는 이름이에요"', async () => {
    const { client } = fakeClient({ rpcError: { message: 'name_taken' } });
    await expect(joinGroup('AB3K9P', '하늘', client)).rejects.toThrow('이미 있는 이름이에요');
  });
});

describe('withRo', () => {
  it.each([
    ['하늘', '하늘로'],
    ['바람', '바람으로'],
    ['구름', '구름으로'],
    ['별', '별로'],
    ['Sky', 'Sky(으)로'],
  ])('%s → %s', (name, expected) => {
    expect(withRo(name)).toBe(expected);
  });
});
