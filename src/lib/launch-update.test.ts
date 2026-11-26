import { RELOADED_AT_KEY, updateOnLaunch } from './launch-update';

function fakeUpdates({ available = true, isNew = true, delayMs = 0, fail = false } = {}) {
  const wait = () => new Promise((r) => setTimeout(r, delayMs));
  return {
    checkForUpdateAsync: jest.fn(async () => {
      await wait();
      if (fail) throw new Error('네트워크');
      return { isAvailable: available };
    }),
    fetchUpdateAsync: jest.fn(async () => {
      await wait();
      return { isNew };
    }),
    reloadAsync: jest.fn(async () => undefined),
  };
}

function memoryStore(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return {
    getItem: async (k: string) => m.get(k) ?? null,
    setItem: async (k: string, v: string) => void m.set(k, v),
  };
}

describe('앱을 새로 열 때 새 판 받기', () => {
  beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('새 판이 있으면 받아서 바로 다시 불러온다', async () => {
    const u = fakeUpdates();
    expect(await updateOnLaunch({ updates: u, store: memoryStore() })).toBe('reloaded');
    expect(u.fetchUpdateAsync).toHaveBeenCalledTimes(1);
    expect(u.reloadAsync).toHaveBeenCalledTimes(1);
  });

  it('최신이면 받지 않고 그대로 연다', async () => {
    const u = fakeUpdates({ available: false });
    expect(await updateOnLaunch({ updates: u })).toBe('latest');
    expect(u.fetchUpdateAsync).not.toHaveBeenCalled();
    expect(u.reloadAsync).not.toHaveBeenCalled();
  });

  it('기다리는 시간을 넘으면 지금 판으로 열고, 늦게 받은 판으로 다시 불러오지 않는다', async () => {
    const u = fakeUpdates({ delayMs: 30 });
    expect(await updateOnLaunch({ updates: u, waitMs: 20 })).toBe('timeout');
    await new Promise((r) => setTimeout(r, 100));
    expect(u.fetchUpdateAsync).toHaveBeenCalledTimes(1);
    expect(u.reloadAsync).not.toHaveBeenCalled();
  });

  it('확인이 실패해도 앱은 지금 판으로 연다', async () => {
    const u = fakeUpdates({ fail: true });
    expect(await updateOnLaunch({ updates: u })).toBe('failed');
    expect(u.reloadAsync).not.toHaveBeenCalled();
  });

  it('방금 다시 불러왔으면 또 확인하지 않는다(되풀이 막기)', async () => {
    const u = fakeUpdates();
    const store = memoryStore({ [RELOADED_AT_KEY]: String(1_000_000) });
    expect(await updateOnLaunch({ updates: u, store, now: () => 1_000_000 + 5_000 })).toBe('skipped');
    expect(u.checkForUpdateAsync).not.toHaveBeenCalled();
  });
});
