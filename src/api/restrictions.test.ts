import {
  getMyRestrictions,
  itemKey,
  RestrictionError,
  restrictionErrorMessage,
  type RestrictionItem,
  saveMyRestrictions,
  toggleItem,
  toPayload,
} from './restrictions';

// 실제 서버 대신 rpc만 흉내 내는 가짜 클라이언트
function fakeClient(opts: { data?: unknown; error?: { message: string } }) {
  const rpc = jest.fn(async () => ({ data: opts.data ?? null, error: opts.error ?? null }));
  return { client: { rpc } as any, rpc };
}

describe('고르기 (spec.md 4-7)', () => {
  it('처음 누르면 들어가고, 다시 누르면 빠진다', () => {
    const once = toggleItem([], { tag: 'seafood' });
    expect(once).toEqual([{ tag: 'seafood', foodId: null }]);
    expect(toggleItem(once, { tag: 'seafood' })).toEqual([]);
  });

  it('태그와 음식은 따로 센다', () => {
    const items = toggleItem(toggleItem([], { tag: 'pork' }), { foodId: 3 });
    expect(items.map(itemKey)).toEqual(['tag:pork', 'food:3']);
  });

  it('서버 p_items 형식으로 바꾼다. 이유는 보내지 않는다', () => {
    const items: RestrictionItem[] = [
      { tag: 'egg', foodId: null },
      { tag: null, foodId: 3 },
    ];
    expect(toPayload(items)).toEqual([{ tag: 'egg' }, { food_id: 3 }]);
  });
});

describe('서버 호출 (spec.md 4-7)', () => {
  it('내 못 먹는 것을 읽는다', async () => {
    const { client, rpc } = fakeClient({
      data: [
        { tag: 'halal', food_id: null },
        { tag: null, food_id: 7 },
      ],
    });
    await expect(getMyRestrictions(client)).resolves.toEqual([
      { tag: 'halal', foodId: null },
      { tag: null, foodId: 7 },
    ]);
    expect(rpc).toHaveBeenCalledWith('get_my_restrictions');
  });

  it('아무것도 안 고르고 저장하면 빈 배열을 보내 전부 해제한다', async () => {
    const { client, rpc } = fakeClient({});
    await saveMyRestrictions([], client);
    expect(rpc).toHaveBeenCalledWith('set_my_restrictions', { p_items: [] });
  });

  it('서버가 invalid_items로 거절하면 한국어 문구', async () => {
    const { client } = fakeClient({ error: { message: 'invalid_items' } });
    const err = await saveMyRestrictions([], client).catch((e) => e);
    expect(err).toBeInstanceOf(RestrictionError);
    expect(restrictionErrorMessage(err)).toBe('저장하지 못했어요. 고른 것을 확인해 주세요');
  });

  it('그 밖의 오류는 "연결할 수 없어요"', async () => {
    const { client } = fakeClient({ error: { message: 'TypeError: Failed to fetch' } });
    const err = await saveMyRestrictions([], client).catch((e) => e);
    expect(restrictionErrorMessage(err)).toBe('연결할 수 없어요');
  });
});
