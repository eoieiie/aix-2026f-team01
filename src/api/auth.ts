import type { SupabaseClient } from '@supabase/supabase-js';

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
