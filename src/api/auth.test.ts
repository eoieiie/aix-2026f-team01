import { ensureAnonymousSession } from './auth';
import { getSupabase, MissingEnvError } from './supabase';

// 실제 서버 대신 auth 두 함수만 흉내 내는 가짜 클라이언트
function fakeClient(opts: {
  session?: { user: { id: string } } | null;
  sessionError?: Error;
  signInUserId?: string;
  signInError?: Error;
}) {
  const signInAnonymously = jest.fn(async () => ({
    data: { user: opts.signInUserId ? { id: opts.signInUserId } : null, session: null },
    error: opts.signInError ?? null,
  }));
  const getSession = jest.fn(async () => ({
    data: { session: opts.session ?? null },
    error: opts.sessionError ?? null,
  }));
  return { client: { auth: { getSession, signInAnonymously } } as any, signInAnonymously };
}

describe('ensureAnonymousSession (spec.md 4-1)', () => {
  it('저장된 로그인이 있으면 새 계정을 만들지 않는다', async () => {
    const { client, signInAnonymously } = fakeClient({ session: { user: { id: 'saved-user' } } });
    await expect(ensureAnonymousSession(client)).resolves.toBe('saved-user');
    expect(signInAnonymously).not.toHaveBeenCalled();
  });

  it('저장된 로그인이 없으면 익명 계정을 만든다', async () => {
    const { client, signInAnonymously } = fakeClient({ signInUserId: 'new-user' });
    await expect(ensureAnonymousSession(client)).resolves.toBe('new-user');
    expect(signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it('익명 로그인이 실패하면 오류를 던진다 (화면은 "연결할 수 없어요")', async () => {
    const { client } = fakeClient({ signInError: new Error('network') });
    await expect(ensureAnonymousSession(client)).rejects.toThrow('network');
  });
});

describe('getSupabase', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('환경변수가 없으면 import 단계가 아니라 부를 때 알 수 있는 오류를 던진다', () => {
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    expect(() => getSupabase()).toThrow(MissingEnvError);
  });
});
