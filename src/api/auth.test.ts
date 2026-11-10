import {
  checkLoginInput,
  claimAccount,
  emailToLoginId,
  ensureAnonymousSession,
  getLoginId,
  loginIdToEmail,
  signInWithLoginId,
  signOutToAnonymous,
} from './auth';
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

describe('아이디로 이어 쓰기 (spec.md 4-19)', () => {
  function accountClient(opts: {
    updateErrors?: ({ code: string } | null)[];
    signInError?: { code: string } | null;
    email?: string | null;
  }) {
    const errors = [...(opts.updateErrors ?? [])];
    const updateUser = jest.fn(async () => ({ data: {}, error: errors.shift() ?? null }));
    const signInWithPassword = jest.fn(async () => ({ data: {}, error: opts.signInError ?? null }));
    const signOut = jest.fn(async () => ({ error: null }));
    const signInAnonymously = jest.fn(async () => ({ data: { user: { id: 'new-anon' }, session: null }, error: null }));
    const getSession = jest.fn(async () => ({
      data: { session: opts.email === undefined ? null : { user: { id: 'u', email: opts.email } } },
      error: null,
    }));
    return {
      client: { auth: { updateUser, signInWithPassword, signOut, signInAnonymously, getSession } } as any,
      updateUser,
      signInWithPassword,
    };
  }

  it('아이디는 영어 소문자, 숫자, _ 3~16자. 비밀번호는 6자 이상', () => {
    expect(checkLoginInput('bab_ti1', '123456')).toBeNull();
    expect(checkLoginInput('ab', '123456')).toBe('id_invalid');
    expect(checkLoginInput('a'.repeat(17), '123456')).toBe('id_invalid');
    expect(checkLoginInput('Babti', '123456')).toBe('id_invalid');
    expect(checkLoginInput('밥비티', '123456')).toBe('id_invalid');
    expect(checkLoginInput('babti', '12345')).toBe('password_short');
  });

  it('서버에는 아이디@babti.invalid로 저장하고, 꺼낼 때는 아이디만', () => {
    expect(loginIdToEmail('babti')).toBe('babti@babti.invalid');
    expect(emailToLoginId('babti@babti.invalid')).toBe('babti');
    expect(emailToLoginId(null)).toBeNull();
    expect(emailToLoginId('someone@gmail.com')).toBeNull();
  });

  it('아이디 만들기는 이메일을 먼저, 비밀번호를 그다음에 붙인다', async () => {
    const { client, updateUser } = accountClient({});
    await expect(claimAccount('babti', '123456', client)).resolves.toBe('babti');
    expect(updateUser).toHaveBeenNthCalledWith(1, { email: 'babti@babti.invalid' });
    expect(updateUser).toHaveBeenNthCalledWith(2, { password: '123456' });
  });

  it('이미 쓰는 아이디면 id_taken이고 비밀번호는 붙이지 않는다', async () => {
    const { client, updateUser } = accountClient({ updateErrors: [{ code: 'email_exists' }] });
    await expect(claimAccount('babti', '123456', client)).rejects.toMatchObject({ code: 'id_taken' });
    expect(updateUser).toHaveBeenCalledTimes(1);
  });

  it('틀린 비밀번호는 wrong_login, 형식이 틀리면 서버에 묻지 않는다', async () => {
    const wrong = accountClient({ signInError: { code: 'invalid_credentials' } });
    await expect(signInWithLoginId('babti', '123456', wrong.client)).rejects.toMatchObject({ code: 'wrong_login' });
    const bad = accountClient({});
    await expect(signInWithLoginId('B', '123456', bad.client)).rejects.toMatchObject({ code: 'id_invalid' });
    expect(bad.signInWithPassword).not.toHaveBeenCalled();
  });

  it('로그아웃하면 새 익명 계정으로 다시 시작한다', async () => {
    const { client } = accountClient({});
    await expect(signOutToAnonymous(client)).resolves.toBe('new-anon');
  });

  it('지금 계정의 아이디: 익명이면 null', async () => {
    await expect(getLoginId(accountClient({ email: 'babti@babti.invalid' }).client)).resolves.toBe('babti');
    await expect(getLoginId(accountClient({ email: null }).client)).resolves.toBeNull();
  });
});
