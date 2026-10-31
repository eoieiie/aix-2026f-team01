import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabase } from './supabase';

// 초대 링크로 참여 (spec.md 4-5). 서버 함수 get_group_by_code, join_group을 부른다

type Client = Pick<SupabaseClient, 'auth' | 'from' | 'rpc'>;

export interface InviteInfo {
  groupId: string;
  groupName: string;
  isMember: boolean;
  // 프로필에 이름이 있으면 그 이름. 없으면 null이고 화면이 이름을 묻는다
  profileName: string | null;
}

export interface JoinResult {
  groupId: string;
  openSessionId: string | null;
}

// 서버가 raise exception으로 보낸 코드. 4절에 문구가 정해진 것만 화면 문구로 바꾼다
export const INVITE_ERROR_MESSAGES: Record<string, string> = {
  group_not_found: '모임을 찾을 수 없어요',
  name_taken: '이미 있는 이름이에요',
};

export class InviteError extends Error {
  constructor(public readonly code: string) {
    super(INVITE_ERROR_MESSAGES[code] ?? code);
    this.name = 'InviteError';
  }
}

// 문구가 정해진 코드면 InviteError, 아니면(네트워크 등) 받은 오류를 그대로 던진다
function throwServerError(error: { message: string }): never {
  if (error.message in INVITE_ERROR_MESSAGES) throw new InviteError(error.message);
  throw error;
}

export async function getInviteInfo(code: string, client: Client = getSupabase()): Promise<InviteInfo> {
  const { data, error } = await client.rpc('get_group_by_code', { p_code: code });
  if (error) throwServerError(error);
  const row = data?.[0];
  if (!row) throw new InviteError('group_not_found');

  const session = await client.auth.getSession();
  if (session.error) throw session.error;
  const userId = session.data.session?.user.id;

  let profileName: string | null = null;
  if (userId) {
    const profile = await client
      .from('profiles')
      .select('display_name')
      .eq('user_id', userId)
      .maybeSingle();
    if (profile.error) throw profile.error;
    profileName = profile.data?.display_name ?? null;
  }

  return { groupId: row.group_id, groupName: row.name, isMember: row.is_member, profileName };
}

// displayName이 null이면 서버가 프로필 이름을 쓴다. 이미 소속이면 이름 없이 넘어간다
export async function joinGroup(
  code: string,
  displayName: string | null,
  client: Client = getSupabase(),
): Promise<JoinResult> {
  const { data, error } = await client.rpc('join_group', {
    p_code: code,
    p_display_name: displayName,
  });
  if (error) throwServerError(error);
  const row = data?.[0];
  if (!row) throw new Error('join_group 응답이 비어 있다');
  return { groupId: row.group_id, openSessionId: row.open_session_id ?? null };
}

// "OO(으)로 들어갈게요"의 조사. 마지막 글자에 받침이 있으면 "으로", 없거나 ㄹ 받침이면 "로"
export function withRo(name: string): string {
  const last = name.charCodeAt(name.length - 1);
  if (last < 0xac00 || last > 0xd7a3) return `${name}(으)로`;
  const final = (last - 0xac00) % 28;
  return final === 0 || final === 8 ? `${name}로` : `${name}으로`;
}
