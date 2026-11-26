import { hasLoginRecord, isFirstWebVisit, markStarted, STARTED_KEY } from './first-visit';

function memory(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    key: (i: number) => Array.from(m.keys())[i] ?? null,
    get length() {
      return m.size;
    },
  };
}

describe('웹 첫 방문은 소개부터', () => {
  it('로그인 기록이 없으면 루트는 소개로 보낸다', () => {
    expect(isFirstWebVisit('/', memory())).toBe(true);
    expect(isFirstWebVisit('', memory())).toBe(true);
  });

  it('초대 링크와 다른 주소는 그대로 간다', () => {
    expect(isFirstWebVisit('/g/ABC123', memory())).toBe(false);
    expect(isFirstWebVisit('/shops', memory())).toBe(false);
    expect(isFirstWebVisit('/about', memory())).toBe(false);
  });

  it('저장된 로그인이 있으면 바로 앱으로 간다', () => {
    const s = memory({ 'sb-ndcqorntilzimgoolzoc-auth-token': '{}' });
    expect(hasLoginRecord(s)).toBe(true);
    expect(isFirstWebVisit('/', s)).toBe(false);
  });

  it('"바로 시작하기"를 누른 뒤에는 다시 소개로 튕기지 않는다', () => {
    const s = memory();
    markStarted(s);
    expect(s.getItem(STARTED_KEY)).toBe('1');
    expect(isFirstWebVisit('/', s)).toBe(false);
  });

  it('네이티브(저장소 없음)는 바뀌지 않는다', () => {
    expect(isFirstWebVisit('/', null)).toBe(false);
  });
});
