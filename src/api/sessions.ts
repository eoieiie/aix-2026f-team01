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
  // vetoed: 이 판에 못 먹는 사람이 있다. 0010부터 빠지지 않고 표시만 한다
  // 목록에 없어서 이름을 직접 적어 올린 메뉴 (4-9). 재료는 이름으로 짐작했다
  custom: boolean;
}

export interface SessionView {
  id: string;
  groupId: string;
  groupName: string;
  status: SessionStatus;
  isHost: boolean;
  // 방장 이름. 방장이 아닌 사람에게 누가 돌리는지 보여 준다
  hostName: string;
  // 몇 명이서 먹는지 (4-6). 이 수만큼 골라야 돌릴 수 있다. 0009 전에 연 판은 null
  expectedCount: number | null;
  decidedFoodId: number | null;
  decidedAt: string | null;
  participants: Participant[];
  candidates: Candidate[];
  // 내가 찍은 후보. 다른 사람 표는 서버 권한 때문에 읽을 수 없다 (4-11)
  myVotes: number[];
  // 내가 "아무거나 괜찮아요"를 눌렀는지. 표 없이 투표한 것으로 친다 (0010)
  myAnyOk: boolean;
  // 이 판 후보에 걸리는 못 먹는 것. 누가 적었는지는 없다 (0010)
  cantEat: CantEat;
}

export interface CantEat {
  // 재료, 식단 태그 코드 (constants/restrictions.ts)
  tags: string[];
  // 음식을 직접 지정한 경우 그 이름
  foods: string[];
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
  name_empty: '메뉴 이름을 적어 주세요',
  name_too_long: '메뉴 이름은 20자까지예요',
  not_all_voted: '아직 고르지 않은 사람이 있어요',
  bad_headcount: '인원은 1명부터 20명까지예요',
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
  // 직접 적은 메뉴(custom)는 그 판에서만 쓰니 고르기 목록에 넣지 않는다.
  // 칸 이름을 적지 않고 *로 읽어서, 서버에 0008이 들어가기 전에도 목록이 나온다
  const { data, error } = await client.from('foods').select('*').order('id');
  if (error) throwSessionError(error);
  return (data ?? []).filter((f: any) => f.custom !== true).map((f: any) => ({ id: f.id, name: f.name }));
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
    .select('*, groups ( name )')
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
      .select('food_id, proposed_by, pitch, vetoed, created_at, foods ( * )')
      .eq('session_id', sessionId),
    client.from('votes').select('food_id').eq('session_id', sessionId),
  ]);
  // 못 먹는 것 안내는 없어도 판은 보인다. 실패하면 빈 안내
  const cantRes: any = await Promise.resolve(
    client.rpc('session_cant_eat', { p_session_id: sessionId })
  ).catch(() => null);
  const cantRows: { tag: string | null; food_name: string | null }[] =
    cantRes && !cantRes.error && Array.isArray(cantRes.data) ? cantRes.data : [];
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
      custom: c.foods?.custom === true,
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
    hostName: names.get(session.host_user_id) ?? '',
    expectedCount: (session as any).expected_count ?? null,
    decidedFoodId: session.decided_food_id,
    decidedAt: session.decided_at,
    participants,
    candidates,
    myVotes: (votesRes.data ?? []).map((v: any) => v.food_id),
    myAnyOk:
      (votesRes.data ?? []).length === 0 &&
      participants.some((p) => p.userId === userId && p.voted),
    cantEat: {
      tags: [...new Set(cantRows.map((r) => r.tag).filter((t): t is string => !!t))],
      foods: [...new Set(cantRows.map((r) => r.food_name).filter((t): t is string => !!t))],
    },
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

// 목록에 없는 메뉴를 이름으로 올린다. 같은 이름이 목록에 있으면 서버가 그 음식으로 올린다.
// 돌려주는 값은 못 먹는 사람이 있어 빠졌는지 (4-9)
export async function addCustomCandidate(
  sessionId: string,
  name: string,
  client: Client = getSupabase()
): Promise<boolean> {
  const { data, error } = await client.rpc('add_custom_candidate', {
    p_session_id: sessionId,
    p_name: name,
  });
  if (error) throwSessionError(error);
  return Boolean((data as { vetoed?: boolean } | null)?.vetoed);
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

// 아무거나 괜찮아요. 내 표를 지우고 투표한 것으로 친다. 다시 누르면 취소 (0010, 인터뷰 2)
export async function setAnyOk(sessionId: string, client: Client = getSupabase()): Promise<boolean> {
  const { data, error } = await client.rpc('set_any_ok', { p_session_id: sessionId });
  if (error) throwSessionError(error);
  return Boolean(data);
}

// 방장만. 몇 명이서 먹는지 바꾼다. 오지 않는 사람이 있으면 줄인다 (4-12)
export async function setExpectedCount(
  sessionId: string,
  count: number,
  client: Client = getSupabase()
): Promise<void> {
  const { error } = await client.rpc('set_expected_count', { p_session_id: sessionId, p_count: count });
  if (error) throwSessionError(error);
}

// 다 골랐는지. 인원수가 있으면 그 수만큼 골라야 하고, 없으면(예전 판) 언제든 된다 (4-12)
export function votingReady(session: Pick<SessionView, 'expectedCount' | 'participants'>): boolean {
  if (session.expectedCount === null) return true;
  return session.participants.filter((p) => p.voted).length >= session.expectedCount;
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

// 4-20 음식마다: 이 판에 못 먹는 사람이 있는지, 이 모임이 몇 번, 마지막으로 언제 먹었는지 (0011)
export interface FoodHint {
  foodId: number;
  blocked: boolean;
  eatenCount: number;
  lastEatenAt: string | null;
}

export async function getFoodHints(sessionId: string, client: Client = getSupabase()): Promise<FoodHint[]> {
  const { data, error } = await client.rpc('session_food_hints', { p_session_id: sessionId });
  if (error) throwSessionError(error);
  return (data ?? []).map((r: any) => ({
    foodId: r.food_id,
    blocked: Boolean(r.blocked),
    eatenCount: r.eaten_count ?? 0,
    lastEatenAt: r.last_eaten_at ?? null,
  }));
}

// 한국 시간 날짜로 며칠 전인지. 오늘이면 0
export function daysAgoKST(iso: string, now: Date = new Date()): number {
  const day = (d: Date) => {
    const k = new Date(d.getTime() + 9 * 3600 * 1000);
    return Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate());
  };
  return Math.round((day(now) - day(new Date(iso))) / 86400000);
}

// 후보 카드 아래 한 줄. 정한 날수보다 오래됐으면 없음
export function eatenNote(lastEatenAt: string | null, withinDays: number, now: Date = new Date()): string | null {
  if (!lastEatenAt) return null;
  const d = daysAgoKST(lastEatenAt, now);
  if (d < 0 || d > withinDays) return null;
  if (d === 0) return '오늘 먹었어요';
  if (d === 1) return '어제 먹었어요';
  return `${d}일 전에 먹었어요`;
}

// 이 모임 단골: 많이 먹은 순, 같으면 최근에 먹은 순. 이미 후보이거나 못 먹는 사람이 있으면 뺀다
export function groupFavorites(hints: FoodHint[], excludeIds: number[], max: number): FoodHint[] {
  const ex = new Set(excludeIds);
  return hints
    .filter((h) => h.eatenCount > 0 && !h.blocked && !ex.has(h.foodId))
    .sort((a, b) => b.eatenCount - a.eatenCount || String(b.lastEatenAt).localeCompare(String(a.lastEatenAt)))
    .slice(0, max);
}

// 빈 판 채우기: 모두 먹을 수 있고, 정한 날수 안에 안 먹은 음식 중에서 무작위로. 모자라면 최근에 먹은 것도 쓴다
export function quickFillPicks(
  hints: FoodHint[],
  excludeIds: number[],
  count: number,
  withinDays: number,
  random: () => number = Math.random,
  now: Date = new Date()
): number[] {
  const ex = new Set(excludeIds);
  const safe = hints.filter((h) => !h.blocked && !ex.has(h.foodId));
  const shuffle = (xs: FoodHint[]) => {
    const a = xs.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const fresh = shuffle(safe.filter((h) => eatenNote(h.lastEatenAt, withinDays, now) === null));
  const recent = shuffle(safe.filter((h) => eatenNote(h.lastEatenAt, withinDays, now) !== null));
  return [...fresh, ...recent].slice(0, count).map((h) => h.foodId);
}

// 원판 조각. 서버 추첨 대상과 같은 규칙: 1표 이상인 후보를 표 수만큼(못 먹는 사람이 있어도).
// 아무도 안 찍었으면 못 먹는 사람이 없는 후보를 1씩, 그런 후보가 없으면 전체를 1씩.
// 순서는 음식 id 순이라 모든 기기가 같다 (4-12, 0010)
export function rouletteSlices(counts: VoteCount[]): { foodId: number; weight: number }[] {
  const all = counts.slice().sort((a, b) => a.foodId - b.foodId);
  const voted = all.filter((c) => c.voteCount > 0);
  if (voted.length > 0) return voted.map((c) => ({ foodId: c.foodId, weight: c.voteCount }));
  const safe = all.filter((c) => !c.vetoed);
  return (safe.length > 0 ? safe : all).map((c) => ({ foodId: c.foodId, weight: 1 }));
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
