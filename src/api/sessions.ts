import { getSupabase } from './supabase';
import type { Client } from './groups';

// 한 판(세션) 화면이 쓰는 서버 호출. 규칙은 서버 함수가 정하고 여기서는 부르고 읽기만 한다 (spec.md 3절 1번, 5절)

export type SessionStatus = 'open' | 'voting' | 'done';

export interface Food {
  id: number;
  name: string;
}

export interface Participant {
  userId: string;
  displayName: string;
  voted: boolean;
}

export interface Candidate {
  foodId: number;
  foodName: string;
  isMine: boolean;
  pitch: string | null;
  vetoed: boolean;
}

export interface SessionView {
  id: string;
  groupId: string;
  groupName: string;
  status: SessionStatus;
  isHost: boolean;
  decidedFoodId: number | null;
  decidedAt: string | null;
  participants: Participant[];
  candidates: Candidate[];
  // 내가 찍은 후보. 다른 사람 표는 서버 권한 때문에 읽을 수 없다 (4-11)
  myVotes: number[];
}

export interface VoteCount {
  foodId: number;
  voteCount: number;
  vetoed: boolean;
}

// 실패 코드를 화면 문구로 (spec.md 5절 표, 4절 실패할 때)
export const SESSION_ERROR_MESSAGES: Record<string, string> = {
  not_signed_in: '로그인이 필요해요',
  not_member: '이 모임 멤버가 아니에요',
  session_not_found: '판을 찾을 수 없어요',
  not_participant: '이 판에 아직 참여하지 않았어요',
  voting_started: '이미 투표가 시작됐어요',
  food_not_found: '음식을 찾을 수 없어요',
  already_candidate: '이미 올라간 음식이에요',
  pitch_too_long: '어필은 60자까지 쓸 수 있어요',
  not_my_candidate: '내가 올린 후보만 고칠 수 있어요',
  not_host: '방장만 할 수 있어요',
  not_open: '후보를 올리는 중에만 할 수 있어요',
  no_candidates: '후보를 하나 이상 올려주세요',
  not_voting: '투표 중에만 할 수 있어요',
  candidate_not_found: '후보를 찾을 수 없어요',
  candidate_vetoed: '못 먹는 사람이 있어서 빠졌어요',
  vote_limit: '최대 2개까지 고를 수 있어요',
  not_done: '아직 결과가 나오지 않았어요',
};

export class SessionError extends Error {
  constructor(public readonly code: string) {
    super(SESSION_ERROR_MESSAGES[code] ?? code);
    this.name = 'SessionError';
  }
}

function throwSessionError(error: { message: string }): never {
  if (error.message in SESSION_ERROR_MESSAGES) throw new SessionError(error.message);
  throw error;
}

// 화면에 보일 문구. 서버 코드가 아니면(네트워크 등) "연결할 수 없어요"
export function sessionErrorMessage(error: unknown): string {
  if (error instanceof SessionError) return error.message;
  return '연결할 수 없어요';
}

async function myUserId(client: Client): Promise<string | null> {
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session?.user?.id ?? null;
}

// 음식 목록 (기본 40개). 검색은 화면에서 이 목록으로 한다 (4-9)
export async function listFoods(client: Client = getSupabase()): Promise<Food[]> {
  const { data, error } = await client.from('foods').select('id, name').order('id');
  if (error) throwSessionError(error);
  return (data ?? []).map((f: any) => ({ id: f.id, name: f.name }));
}

// 이름 일부로 찾는다. 이미 올라간 음식은 빼고 최대 limit개 (4-9)
export function searchFoods(
  foods: Food[],
  query: string,
  excludeIds: number[],
  limit: number
): Food[] {
  const q = query.trim();
  const excluded = new Set(excludeIds);
  return foods.filter((f) => !excluded.has(f.id) && (q === '' || f.name.includes(q))).slice(0, limit);
}

// 판 화면에 들어오면 참여자가 된다. 끝난 판이면 참여자로 넣지 않고 상태만 돌려준다 (4-8)
export async function joinSession(
  sessionId: string,
  client: Client = getSupabase()
): Promise<SessionStatus> {
  const { data, error } = await client.rpc('join_session', { p_session_id: sessionId });
  if (error) throwSessionError(error);
  return data as SessionStatus;
}

// 판 하나를 통째로 읽는다. 실시간 변경이 오면 이걸 다시 부른다 (spec.md 5절 실시간 구독)
export async function getSession(
  sessionId: string,
  client: Client = getSupabase()
): Promise<SessionView> {
  const userId = await myUserId(client);

  const { data: session, error: sessionError } = await client
    .from('sessions')
    .select('id, group_id, host_user_id, status, decided_food_id, decided_at, groups ( name )')
    .eq('id', sessionId)
    .maybeSingle();
  if (sessionError) throwSessionError(sessionError);
  // 소속이 아니면 권한 때문에 판이 안 보인다 (4-8, 4-6)
  if (!session) throw new SessionError('not_member');

  const [participantsRes, membersRes, candidatesRes, votesRes] = await Promise.all([
    client.from('session_participants').select('user_id, voted, joined_at').eq('session_id', sessionId),
    client.from('memberships').select('user_id, display_name').eq('group_id', session.group_id),
    client
      .from('candidates')
      .select('food_id, proposed_by, pitch, vetoed, created_at, foods ( name )')
      .eq('session_id', sessionId),
    client.from('votes').select('food_id').eq('session_id', sessionId),
  ]);
  for (const res of [participantsRes, membersRes, candidatesRes, votesRes]) {
    if (res.error) throwSessionError(res.error);
  }

  const names = new Map<string, string>(
    (membersRes.data ?? []).map((m: any) => [m.user_id, m.display_name])
  );

  const participants: Participant[] = (participantsRes.data ?? [])
    .slice()
    .sort((a: any, b: any) => String(a.joined_at).localeCompare(String(b.joined_at)))
    .map((p: any) => ({
      userId: p.user_id,
      displayName: names.get(p.user_id) ?? '',
      voted: p.voted,
    }));

  // 올린 순서대로. 누가 원인인지는 서버가 저장하지 않으므로 vetoed만 온다 (4-9 익명 규칙)
  const candidates: Candidate[] = (candidatesRes.data ?? [])
    .slice()
    .sort((a: any, b: any) => String(a.created_at).localeCompare(String(b.created_at)))
    .map((c: any) => ({
      foodId: c.food_id,
      foodName: c.foods?.name ?? '',
      isMine: c.proposed_by === userId,
      pitch: c.pitch,
      vetoed: c.vetoed,
    }));

  return {
    id: session.id,
    groupId: session.group_id,
    groupName: (session as any).groups?.name ?? '',
    status: session.status,
    isHost: session.host_user_id === userId,
    decidedFoodId: session.decided_food_id,
    decidedAt: session.decided_at,
    participants,
    candidates,
    myVotes: (votesRes.data ?? []).map((v: any) => v.food_id),
  };
}

// 후보 올리기. 돌려주는 값은 못 먹는 사람이 있어 빠졌는지 (4-9)
export async function addCandidate(
  sessionId: string,
  foodId: number,
  client: Client = getSupabase()
): Promise<boolean> {
  const { data, error } = await client.rpc('add_candidate', {
    p_session_id: sessionId,
    p_food_id: foodId,
  });
  if (error) throwSessionError(error);
  return Boolean(data);
}

// 내가 올린 후보의 어필. 빈 글이면 지운다 (4-9)
export async function setPitch(
  sessionId: string,
  foodId: number,
  pitch: string,
  client: Client = getSupabase()
): Promise<void> {
  const { error } = await client.rpc('set_pitch', {
    p_session_id: sessionId,
    p_food_id: foodId,
    p_pitch: pitch,
  });
  if (error) throwSessionError(error);
}

export async function removeCandidate(
  sessionId: string,
  foodId: number,
  client: Client = getSupabase()
): Promise<void> {
  const { error } = await client.rpc('remove_candidate', {
    p_session_id: sessionId,
    p_food_id: foodId,
  });
  if (error) throwSessionError(error);
}

// 방장만. 모든 기기가 투표 화면으로 바뀐다 (4-10)
export async function openVoting(sessionId: string, client: Client = getSupabase()): Promise<void> {
  const { error } = await client.rpc('open_voting', { p_session_id: sessionId });
  if (error) throwSessionError(error);
}

// 누르면 찍힘과 취소가 바뀐다. 돌려주는 값은 누른 뒤 찍혀 있는지 (4-11)
export async function castVote(
  sessionId: string,
  foodId: number,
  client: Client = getSupabase()
): Promise<boolean> {
  const { data, error } = await client.rpc('cast_vote', {
    p_session_id: sessionId,
    p_food_id: foodId,
  });
  if (error) throwSessionError(error);
  return Boolean(data);
}

// 방장만. 서버가 표 수에 비례해 하나를 뽑고 판을 끝내고 식사 기록을 만든다 (4-12, 4-13)
export async function spinRoulette(
  sessionId: string,
  client: Client = getSupabase()
): Promise<{ foodId: number; mealId: string }> {
  const { data, error } = await client.rpc('spin_roulette', { p_session_id: sessionId });
  if (error) throwSessionError(error);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('spin_roulette 응답이 비어 있다');
  return { foodId: row.food_id, mealId: row.meal_id };
}

// 끝난 판에서만 음식별 표 수. 누가 찍었는지는 오지 않는다 (4-12)
export async function getVoteCounts(
  sessionId: string,
  client: Client = getSupabase()
): Promise<VoteCount[]> {
  const { data, error } = await client.rpc('session_vote_counts', { p_session_id: sessionId });
  if (error) throwSessionError(error);
  return (data ?? []).map((r: any) => ({
    foodId: r.food_id,
    voteCount: r.vote_count,
    vetoed: r.vetoed,
  }));
}

// 원판 조각. 서버 추첨 대상과 같은 규칙: 빠지지 않았고 1표 이상인 후보를 표 수만큼,
// 아무도 안 찍었으면 빠지지 않은 후보 전체를 1씩. 순서는 음식 id 순이라 모든 기기가 같다 (4-12)
export function rouletteSlices(counts: VoteCount[]): { foodId: number; weight: number }[] {
  const alive = counts.filter((c) => !c.vetoed).sort((a, b) => a.foodId - b.foodId);
  const voted = alive.filter((c) => c.voteCount > 0);
  if (voted.length > 0) return voted.map((c) => ({ foodId: c.foodId, weight: c.voteCount }));
  return alive.map((c) => ({ foodId: c.foodId, weight: 1 }));
}

// 판 하나의 변경을 구독한다. 무엇이 바뀌었든 onChange를 부르고, 화면은 판을 통째로 다시 읽는다.
// votes는 구독하지 않는다. 투표했는지는 session_participants.voted로 온다 (0005 migration)
export function subscribeSession(
  sessionId: string,
  onChange: () => void,
  client = getSupabase()
): () => void {
  const channel = client
    .channel(`session:${sessionId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` },
      onChange
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'session_participants',
        filter: `session_id=eq.${sessionId}`,
      },
      onChange
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'candidates', filter: `session_id=eq.${sessionId}` },
      onChange
    )
    // 후보 빼기(DELETE)는 Realtime이 filter를 적용하지 못해서 따로 받고 판 id로 거른다
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'candidates' }, (payload) => {
      if ((payload.old as { session_id?: string })?.session_id === sessionId) onChange();
    })
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}
