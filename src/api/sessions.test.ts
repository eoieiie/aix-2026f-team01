import {
  addCandidate,
  castVote,
  getSession,
  getVoteCounts,
  rouletteSlices,
  searchFoods,
  SessionError,
  sessionErrorMessage,
  spinRoulette,
} from './sessions';

// 표마다 돌려줄 행을 정해 두는 가짜 클라이언트. select(...).eq(...)까지만 쓰므로 그만큼만 흉내 낸다
function fakeClient(opts: {
  userId?: string;
  tables?: Record<string, any>;
  rpc?: Record<string, { data?: unknown; error?: { message: string } }>;
}) {
  const rpc = jest.fn(async (fn: string, _args: unknown) => ({
    data: opts.rpc?.[fn]?.data ?? null,
    error: opts.rpc?.[fn]?.error ?? null,
  }));
  const from = jest.fn((table: string) => {
    const rows = opts.tables?.[table];
    const result = { data: rows ?? [], error: null };
    return {
      select: () => ({
        eq: () => ({
          ...result,
          maybeSingle: async () => ({ data: rows ?? null, error: null }),
        }),
        order: async () => result,
      }),
    };
  });
  const getSessionAuth = jest.fn(async () => ({
    data: { session: { user: { id: opts.userId ?? 'me' } } },
    error: null,
  }));
  return { client: { rpc, from, auth: { getSession: getSessionAuth } } as any, rpc };
}

describe('src/api/sessions.ts', () => {
  it('판을 읽으면 방장 여부, 내 후보, 내 표, 참여자 이름이 붙는다', async () => {
    const { client } = fakeClient({
      userId: 'me',
      tables: {
        sessions: {
          id: 's1',
          group_id: 'g1',
          host_user_id: 'me',
          status: 'open',
          decided_food_id: null,
          decided_at: null,
          groups: { name: '점심 팟' },
        },
        session_participants: [
          { user_id: 'other', voted: true, joined_at: '2026-10-31T01:00:01Z' },
          { user_id: 'me', voted: false, joined_at: '2026-10-31T01:00:00Z' },
        ],
        memberships: [
          { user_id: 'me', display_name: '나' },
          { user_id: 'other', display_name: '친구' },
        ],
        candidates: [
          { food_id: 2, proposed_by: 'other', pitch: null, vetoed: true, created_at: '2', foods: { name: '마라탕' } },
          { food_id: 1, proposed_by: 'me', pitch: '든든', vetoed: false, created_at: '1', foods: { name: '김치찌개' } },
        ],
        votes: [{ food_id: 1 }],
      },
    });

    const view = await getSession('s1', client);

    expect(view.isHost).toBe(true);
    expect(view.groupName).toBe('점심 팟');
    expect(view.participants.map((p) => p.displayName)).toEqual(['나', '친구']);
    expect(view.candidates.map((c) => [c.foodName, c.isMine, c.vetoed])).toEqual([
      ['김치찌개', true, false],
      ['마라탕', false, true],
    ]);
    expect(view.myVotes).toEqual([1]);
  });

  it('소속이 아니라 판이 안 보이면 "이 모임 멤버가 아니에요"', async () => {
    const { client } = fakeClient({ tables: { sessions: null } });
    await expect(getSession('s1', client)).rejects.toThrow('이 모임 멤버가 아니에요');
  });

  it('3번째 표는 서버 코드 vote_limit을 화면 문구로 바꾼다 (4-11)', async () => {
    const { client } = fakeClient({ rpc: { cast_vote: { error: { message: 'vote_limit' } } } });
    const err = await castVote('s1', 3, client).catch((e) => e);
    expect(err).toBeInstanceOf(SessionError);
    expect(sessionErrorMessage(err)).toBe('최대 2개까지 고를 수 있어요');
  });

  it('투표가 시작된 뒤 후보를 올리면 "이미 투표가 시작됐어요" (4-9)', async () => {
    const { client } = fakeClient({ rpc: { add_candidate: { error: { message: 'voting_started' } } } });
    await expect(addCandidate('s1', 3, client)).rejects.toThrow('이미 투표가 시작됐어요');
  });

  it('서버 코드가 아닌 오류는 "연결할 수 없어요"', () => {
    expect(sessionErrorMessage(new TypeError('Failed to fetch'))).toBe('연결할 수 없어요');
  });

  it('룰렛 결과와 표 수를 화면용 이름으로 바꾼다', async () => {
    const { client } = fakeClient({
      rpc: {
        spin_roulette: { data: [{ food_id: 7, meal_id: 'm1' }] },
        session_vote_counts: { data: [{ food_id: 7, vote_count: 3, vetoed: false }] },
      },
    });
    await expect(spinRoulette('s1', client)).resolves.toEqual({ foodId: 7, mealId: 'm1' });
    await expect(getVoteCounts('s1', client)).resolves.toEqual([
      { foodId: 7, voteCount: 3, vetoed: false },
    ]);
  });
});

describe('rouletteSlices: 원판 조각은 서버 추첨 대상과 같다 (4-12)', () => {
  it('1표 이상인 후보만, 표 수만큼', () => {
    expect(
      rouletteSlices([
        { foodId: 3, voteCount: 1, vetoed: false },
        { foodId: 1, voteCount: 3, vetoed: false },
        { foodId: 2, voteCount: 0, vetoed: false },
      ])
    ).toEqual([
      { foodId: 1, weight: 3 },
      { foodId: 3, weight: 1 },
    ]);
  });

  it('아무도 안 찍었으면 빠지지 않은 후보 전체를 똑같이', () => {
    expect(
      rouletteSlices([
        { foodId: 2, voteCount: 0, vetoed: false },
        { foodId: 1, voteCount: 0, vetoed: true },
        { foodId: 4, voteCount: 0, vetoed: false },
      ])
    ).toEqual([
      { foodId: 2, weight: 1 },
      { foodId: 4, weight: 1 },
    ]);
  });

  it('빠진 후보는 표가 있어도 조각이 없다', () => {
    expect(
      rouletteSlices([
        { foodId: 1, voteCount: 2, vetoed: true },
        { foodId: 2, voteCount: 1, vetoed: false },
      ])
    ).toEqual([{ foodId: 2, weight: 1 }]);
  });
});

describe('searchFoods: 음식 검색 (4-9)', () => {
  const foods = [
    { id: 1, name: '김치찌개' },
    { id: 2, name: '된장찌개' },
    { id: 3, name: '김밥' },
  ];

  it('이름 일부로 찾고 이미 올라간 음식은 뺀다', () => {
    expect(searchFoods(foods, '찌개', [1], 6).map((f) => f.name)).toEqual(['된장찌개']);
  });

  it('최대 개수까지만', () => {
    expect(searchFoods(foods, '', [], 2)).toHaveLength(2);
  });
});
