import type { SupabaseClient } from '@supabase/supabase-js';

import { HANDLE_MAX, HANDLE_MIN, LOGIN_EMAIL_DOMAIN, PASSWORD_MIN } from '@/constants';

import { getSupabase } from './supabase';

// 저장된 로그인이 있으면 그대로 쓰고, 없으면 익명 계정을 만든다 (spec.md 4-1).
// 돌려주는 값은 로그인한 사람의 user id
export async function ensureAnonymousSession(
  client: Pick<SupabaseClient, 'auth'> = getSupabase(),
): Promise<string> {
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  if (data.session) return data.session.user.id;

  const signIn = await client.auth.signInAnonymously();
  if (signIn.error) throw signIn.error;
  if (!signIn.data.user) throw new Error('익명 로그인 응답에 사용자가 없다');
  return signIn.data.user.id;
}

// 4-19 아이디로 이어 쓰기 ------------------------------------------------------------

export type AccountErrorCode = 'id_invalid' | 'password_short' | 'id_taken' | 'wrong_login' | 'network';

export class AccountError extends Error {
  code: AccountErrorCode;
  constructor(code: AccountErrorCode) {
    super(code);
    this.name = 'AccountError';
    this.code = code;
  }
}

const LOGIN_ID_PATTERN = new RegExp(`^[a-z0-9_]{${HANDLE_MIN},${HANDLE_MAX}}$`);

export function loginIdToEmail(loginId: string) {
  return `${loginId}@${LOGIN_EMAIL_DOMAIN}`;
}

// 서버에 저장된 이메일에서 아이디만 꺼낸다. 익명 계정이면 null
export function emailToLoginId(email: string | null | undefined): string | null {
  const suffix = `@${LOGIN_EMAIL_DOMAIN}`;
  if (!email || !email.endsWith(suffix)) return null;
  return email.slice(0, -suffix.length);
}

// 서버에 묻기 전에 앱에서 먼저 거른다. 통과하면 null
export function checkLoginInput(loginId: string, password: string): AccountErrorCode | null {
  if (!LOGIN_ID_PATTERN.test(loginId)) return 'id_invalid';
  if (password.length < PASSWORD_MIN) return 'password_short';
  return null;
}

// Supabase 오류를 화면 문구용 코드로 바꾼다. 원문(영어)은 화면에 보이지 않는다
function toAccountError(error: { code?: string; status?: number; name?: string }): AccountError {
  if (error.code === 'email_exists' || error.code === 'user_already_exists') return new AccountError('id_taken');
  if (error.code === 'invalid_credentials') return new AccountError('wrong_login');
  if (error.code === 'weak_password') return new AccountError('password_short');
  return new AccountError('network');
}

type AuthClient = Pick<SupabaseClient, 'auth'>;

export async function getLoginId(client: AuthClient = getSupabase()): Promise<string | null> {
  const { data } = await client.auth.getSession();
  return emailToLoginId(data.session?.user.email);
}

// 지금 쓰던 익명 계정에 아이디와 비밀번호를 붙인다. 모임과 기록은 그대로 남는다.
// 서버는 이메일을 먼저 붙여야 비밀번호를 받는다. 두 번째에서 실패해도 다시 누르면 이어서 된다
export async function claimAccount(
  loginId: string,
  password: string,
  client: AuthClient = getSupabase(),
): Promise<string> {
  const invalid = checkLoginInput(loginId, password);
  if (invalid) throw new AccountError(invalid);

  const email = await client.auth.updateUser({ email: loginIdToEmail(loginId) });
  if (email.error) throw toAccountError(email.error);
  const pass = await client.auth.updateUser({ password });
  if (pass.error) throw toAccountError(pass.error);
  return loginId;
}

// 다른 기기에서 만든 아이디로 들어온다. 이 기기의 익명 계정 기록은 옮겨지지 않는다
export async function signInWithLoginId(
  loginId: string,
  password: string,
  client: AuthClient = getSupabase(),
): Promise<string> {
  const invalid = checkLoginInput(loginId, password);
  if (invalid) throw new AccountError(invalid === 'password_short' ? 'wrong_login' : invalid);

  const { error } = await client.auth.signInWithPassword({ email: loginIdToEmail(loginId), password });
  if (error) throw toAccountError(error);
  return loginId;
}

// 로그아웃하면 새 익명 계정으로 다시 시작한다. 아이디로 다시 들어오면 기록이 돌아온다
export async function signOutToAnonymous(client: AuthClient = getSupabase()): Promise<string> {
  const { error } = await client.auth.signOut();
  if (error) throw toAccountError(error);
  return ensureAnonymousSession(client);
}
