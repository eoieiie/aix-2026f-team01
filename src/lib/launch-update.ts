// 앱을 새로 열 때 새 판이 있으면 받아서 바로 다시 불러온다 (명세 4-31, 2026-11-26).
// 전에는 새 판을 받은 다음 실행에야 적용돼, 앱을 두 번 새로 열어야 했다. 시연 주간에 팀 폰이 예전 판에 머무는 일을 막는다.
// 시작 화면(splash)을 가린 채 최대 4초까지만 기다리고, 넘으면 지금 판으로 연다. 받던 판은 expo-updates가 다음 실행에 쓴다.
// 실패해도 앱은 지금 판으로 정상 동작한다. 새로 열 때만 부르므로 판(모임 투표) 화면 도중에는 다시 불러오지 않는다

export const LAUNCH_UPDATE_WAIT_MS = 4000;
// 다시 불러온 직후 또 다시 불러오는 일을 막는 시간. 받은 판이 열리지 않아도 되풀이하지 않는다
export const RELOAD_GUARD_MS = 60_000;
export const RELOADED_AT_KEY = 'babti:update-reloaded-at';

export type LaunchUpdateResult = 'reloaded' | 'latest' | 'later' | 'timeout' | 'failed' | 'skipped';

type UpdatesApi = {
  checkForUpdateAsync: () => Promise<{ isAvailable: boolean }>;
  fetchUpdateAsync: () => Promise<{ isNew: boolean }>;
  reloadAsync: () => Promise<void>;
};

type GuardStore = {
  getItem: (k: string) => Promise<string | null>;
  setItem: (k: string, v: string) => Promise<void>;
};

export async function updateOnLaunch({
  updates,
  store,
  waitMs = LAUNCH_UPDATE_WAIT_MS,
  now = () => Date.now(),
}: {
  updates: UpdatesApi;
  store?: GuardStore;
  waitMs?: number;
  now?: () => number;
}): Promise<LaunchUpdateResult> {
  let late = false;

  const work = (async (): Promise<LaunchUpdateResult> => {
    try {
      const last = Number((await store?.getItem(RELOADED_AT_KEY)) ?? 0);
      if (last && now() - last < RELOAD_GUARD_MS) return 'skipped';
      const check = await updates.checkForUpdateAsync();
      if (!check.isAvailable) return 'latest';
      const fetched = await updates.fetchUpdateAsync();
      if (!fetched.isNew) return 'latest';
      // 4초를 넘겨 받았으면 지금 판으로 이미 열렸다. 다음 실행에 적용한다
      if (late) return 'later';
      await store?.setItem(RELOADED_AT_KEY, String(now()));
      await updates.reloadAsync();
      return 'reloaded';
    } catch (e) {
      console.warn('[update] 새 판 확인 실패, 지금 판으로 연다', e);
      return 'failed';
    }
  })();

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<LaunchUpdateResult>((resolve) => {
    timer = setTimeout(() => {
      late = true;
      resolve('timeout');
    }, waitMs);
  });

  const result = await Promise.race([work, timeout]);
  clearTimeout(timer);
  return result;
}
