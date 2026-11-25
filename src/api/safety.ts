import { signOutToAnonymous } from './auth';
import { getSupabase } from './supabase';

// 출시 필수 (명세 4-24): 신고, 차단, 모임 나가기·이름 바꾸기, 판 접기, 내 이름 바꾸기, 계정 삭제
type Client = ReturnType<typeof getSupabase>;

export const SAFETY_ERROR_MESSAGES: Record<string, string> = {
  not_signed_in: '로그인이 필요해요',
  not_member: '이 모임 멤버가 아니에요',
  not_owner: '방장만 할 수 있어요',
  not_host: '판을 연 사람만 할 수 있어요',
  already_done: '이미 끝난 판이에요',
  session_not_found: '판을 찾을 수 없어요',
  blocked_word: '쓸 수 없는 말이 있어요',
  name_empty: '이름을 적어 주세요',
  name_too_long: '이름이 너무 길어요',
  name_taken: '모임에 같은 이름이 있어요',
  cannot_block_self: '나는 차단할 수 없어요',
  report_target_not_found: '신고할 글을 찾을 수 없어요',
  too_many_reports: '오늘은 신고를 더 받을 수 없어요',
};

export class SafetyError extends Error {
  constructor(public readonly code: string) {
    super(SAFETY_ERROR_MESSAGES[code] ?? code);
    this.name = 'SafetyError';
  }
}

export function safetyErrorMessage(error: unknown): string {
  if (error instanceof SafetyError) return error.message;
  return '연결할 수 없어요';
}

async function call(fn: string, args: Record<string, unknown>, client: Client) {
  const { data, error } = await client.rpc(fn, args);
  if (error) {
    if (error.message in SAFETY_ERROR_MESSAGES) throw new SafetyError(error.message);
    throw error;
  }
  return data;
}

export type ReportKind = 'pitch' | 'custom_food' | 'group_name' | 'member_name';
export type ReportReason = 'abuse' | 'sexual' | 'spam' | 'other';
export const REPORT_REASONS: { code: ReportReason; label: string }[] = [
  { code: 'abuse', label: '욕설, 비하' },
  { code: 'sexual', label: '성적인 내용' },
  { code: 'spam', label: '광고, 도배' },
  { code: 'other', label: '그 밖에 불쾌한 내용' },
];

export async function reportContent(
  input: { kind: ReportKind; reason: ReportReason; groupId: string; sessionId?: string; foodId?: number; userId?: string },
  client: Client = getSupabase()
): Promise<void> {
  await call(
    'report_content',
    {
      p_kind: input.kind,
      p_reason: input.reason,
      p_group_id: input.groupId,
      p_session_id: input.sessionId ?? null,
      p_food_id: input.foodId ?? null,
      p_user_id: input.userId ?? null,
    },
    client
  );
}

export async function blockUser(userId: string, client: Client = getSupabase()) {
  await call('block_user', { p_user_id: userId }, client);
}

export async function unblockUser(userId: string, client: Client = getSupabase()) {
  await call('unblock_user', { p_user_id: userId }, client);
}

export interface BlockedPerson {
  userId: string;
  displayName: string | null;
}

export async function listMyBlocks(client: Client = getSupabase()): Promise<BlockedPerson[]> {
  const data = (await call('my_blocks', {}, client)) as any[] | null;
  return (data ?? []).map((r) => ({ userId: r.user_id, displayName: r.display_name }));
}

export async function leaveGroup(groupId: string, client: Client = getSupabase()) {
  await call('leave_group', { p_group_id: groupId }, client);
}

export async function renameGroup(groupId: string, name: string, client: Client = getSupabase()) {
  await call('rename_group', { p_group_id: groupId, p_name: name }, client);
}

export async function cancelSession(sessionId: string, client: Client = getSupabase()) {
  await call('cancel_session', { p_session_id: sessionId }, client);
}

export async function setMyName(name: string, client: Client = getSupabase()): Promise<string> {
  return (await call('set_my_name', { p_name: name }, client)) as string;
}

// 서버에서 계정을 지운 뒤 새 익명 사용자로 처음 화면부터 시작한다
export async function deleteMyAccount(client: Client = getSupabase()): Promise<void> {
  await call('delete_my_account', {}, client);
  await signOutToAnonymous(client);
}
