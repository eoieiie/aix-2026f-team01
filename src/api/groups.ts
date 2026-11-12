import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';

import { HOME_RECENT_FOODS, RECENT_MEALS_LIMIT } from '@/constants';

import { getSupabase } from './supabase';

export type Client = Pick<SupabaseClient, 'auth' | 'from' | 'rpc'>;

export interface Group {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
  last_visited_at: string;
  // 홈 모임 카드에 보이는 것 (docs/design.md 1절). 멤버 이름은 들어온 순서
  members: string[];
  recent_foods: { food_id: number; food_name: string }[];
  has_open_session: boolean;
}

export interface Member {
  user_id: string;
  display_name: string;
  joined_at: string;
}

export interface RecentMeal {
  id: string;
  food_id: number;
  food_name: string;
  eaten_at: string;
}

export interface GroupDetail {
  id: string;
  name: string;
  invite_code: string;
  is_member: boolean;
  open_session_id: string | null;
  members: Member[];
  recent_meals: RecentMeal[];
}

export interface CreateGroupInput {
  name: string;
  displayName?: string | null;
}

export interface CreateGroupResult {
  group_id: string;
  invite_code: string;
}

export const GROUP_ERROR_MESSAGES: Record<string, string> = {
  name_empty: '이름을 입력해주세요',
  name_too_long: '이름이 너무 길어요',
  display_name_required: '이름을 입력해주세요',
  not_member: '이 모임 멤버가 아니에요',
  not_signed_in: '로그인이 필요해요',
  group_not_found: '모임을 찾을 수 없어요',
};

export class GroupError extends Error {
  constructor(public readonly code: string) {
    super(GROUP_ERROR_MESSAGES[code] ?? code);
    this.name = 'GroupError';
  }
}

export function throwServerError(error: { message: string }): never {
  if (error.message in GROUP_ERROR_MESSAGES) throw new GroupError(error.message);
  throw error;
}

const VISIT_PREFIX = '@babti:visited_group:';

export async function recordGroupVisit(groupId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(`${VISIT_PREFIX}${groupId}`, new Date().toISOString());
  } catch {
    // 저장 실패는 무시 (UI 치명적이지 않음)
  }
}

export async function getGroupVisitTime(groupId: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(`${VISIT_PREFIX}${groupId}`);
  } catch {
    return null;
  }
}

// 내 프로필 이름. 있으면 모임을 만들 때 이름을 다시 묻지 않는다 (4-2)
export async function getMyProfileName(client: Client = getSupabase()): Promise<string | null> {
  const session = await client.auth.getSession();
  if (session.error) throw session.error;
  const userId = session.data.session?.user?.id;
  if (!userId) return null;

  const { data, error } = await client
    .from('profiles')
    .select('display_name')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throwServerError(error);
  return data?.display_name ?? null;
}

// 4-2. 모임 만들기 (RPC create_group)
export async function createGroup(
  input: CreateGroupInput,
  client: Client = getSupabase()
): Promise<CreateGroupResult> {
  const { data, error } = await client.rpc('create_group', {
    p_name: input.name,
    p_display_name: input.displayName || null,
  });
  if (error) throwServerError(error);
  const row = data?.[0];
  if (!row) throw new Error('create_group 응답이 비어 있다');

  const result = { group_id: row.group_id, invite_code: row.invite_code };
  await recordGroupVisit(row.group_id);
  return result;
}

// 4-3. 내 모임 목록 (memberships JOIN groups). 카드에 보일 멤버 이름, 최근 먹은 것, 진행 중인 판도 같이 읽는다
// sessions는 meals를 거쳐서도 groups와 이어져서, 어느 관계로 붙일지 외래 키 이름을 적는다
const MY_GROUPS_SELECT =
  'group_id, joined_at, groups ( id, name, invite_code, created_at, ' +
  'members:memberships ( display_name, joined_at ), ' +
  'sessions!sessions_group_id_fkey ( status ), ' +
  'meals ( food_id, eaten_at, foods ( name ) ) )';

export async function getMyGroups(client: Client = getSupabase()): Promise<Group[]> {
  const session = await client.auth.getSession();
  if (session.error) throw session.error;
  const userId = session.data.session?.user?.id;
  if (!userId) return [];

  const { data, error } = await client
    .from('memberships')
    .select(MY_GROUPS_SELECT)
    .eq('user_id', userId);

  if (error) throwServerError(error);
  if (!data) return [];

  const groupsWithVisits = await Promise.all(
    data.map(async (row: any) => {
      const g = row.groups;
      if (!g) return null;
      const visitedAt = (await getGroupVisitTime(g.id)) || row.joined_at || g.created_at;
      const members = [...(g.members ?? [])].sort((a: any, b: any) =>
        String(a.joined_at).localeCompare(String(b.joined_at))
      );
      const meals = [...(g.meals ?? [])].sort((a: any, b: any) =>
        String(b.eaten_at).localeCompare(String(a.eaten_at))
      );
      return {
        id: g.id,
        name: g.name,
        invite_code: g.invite_code,
        created_at: g.created_at,
        last_visited_at: visitedAt,
        members: members.map((m: any) => m.display_name),
        recent_foods: meals.slice(0, HOME_RECENT_FOODS).map((m: any) => ({
          food_id: m.food_id,
          food_name: m.foods?.name ?? '식사',
        })),
        has_open_session: (g.sessions ?? []).some((s: any) => s.status !== 'done'),
      } as Group;
    })
  );

  const validGroups = groupsWithVisits.filter((g): g is Group => g !== null);
  validGroups.sort(
    (a, b) => new Date(b.last_visited_at).getTime() - new Date(a.last_visited_at).getTime()
  );

  return validGroups;
}

// 4-6. 모임 상세 화면 데이터 조회
export async function getGroupDetail(
  groupId: string,
  client: Client = getSupabase()
): Promise<GroupDetail> {
  const session = await client.auth.getSession();
  if (session.error) throw session.error;
  const userId = session.data.session?.user?.id;

  // 1. 모임 정보
  const { data: groupData, error: groupError } = await client
    .from('groups')
    .select('id, name, invite_code, created_at')
    .eq('id', groupId)
    .maybeSingle();

  if (groupError) throwServerError(groupError);
  if (!groupData) {
    return {
      id: groupId,
      name: '',
      invite_code: '',
      is_member: false,
      open_session_id: null,
      members: [],
      recent_meals: [],
    };
  }

  // 2. 멤버 목록
  const { data: membersData, error: membersError } = await client
    .from('memberships')
    .select('user_id, display_name, joined_at')
    .eq('group_id', groupId);

  if (membersError) throwServerError(membersError);
  const members: Member[] = (membersData ?? []).map((m: any) => ({
    user_id: m.user_id,
    display_name: m.display_name,
    joined_at: m.joined_at,
  }));

  const isMember = userId ? members.some((m) => m.user_id === userId) : false;
  if (!isMember) {
    return {
      id: groupId,
      name: groupData.name,
      invite_code: groupData.invite_code,
      is_member: false,
      open_session_id: null,
      members: [],
      recent_meals: [],
    };
  }

  // 3. 진행 중인 판 (sessions where status <> 'done')
  const { data: sessionData, error: sessionError } = await client
    .from('sessions')
    .select('id')
    .eq('group_id', groupId)
    .neq('status', 'done')
    .maybeSingle();

  if (sessionError) throwServerError(sessionError);
  const openSessionId = sessionData?.id ?? null;

  // 4. 최근 식사 5개 (meals + foods)
  const { data: mealsData, error: mealsError } = await client
    .from('meals')
    .select('id, food_id, eaten_at, foods ( name )')
    .eq('group_id', groupId)
    .order('eaten_at', { ascending: false })
    .limit(RECENT_MEALS_LIMIT);

  if (mealsError) throwServerError(mealsError);
  const recentMeals: RecentMeal[] = (mealsData ?? []).map((m: any) => ({
    id: m.id,
    food_id: m.food_id,
    food_name: m.foods?.name ?? '식사',
    eaten_at: m.eaten_at,
  }));

  // 방문 시간 기록
  await recordGroupVisit(groupId);

  return {
    id: groupData.id,
    name: groupData.name,
    invite_code: groupData.invite_code,
    is_member: true,
    open_session_id: openSessionId,
    members,
    recent_meals: recentMeals,
  };
}

// 판 시작 (RPC start_session). 새 판이면 먹을 인원수를 함께 보낸다. 진행 중인 판이 있으면 서버가 그 판을 돌려주고 인원수는 무시한다
export async function startSession(
  groupId: string,
  expectedCount?: number,
  client: Client = getSupabase()
): Promise<string> {
  const { data, error } = await client.rpc(
    'start_session',
    expectedCount === undefined
      ? { p_group_id: groupId }
      : { p_group_id: groupId, p_expected_count: expectedCount }
  );
  if (error) throwServerError(error);
  if (!data) throw new Error('start_session 응답이 비어 있다');
  return data;
}

// 4-16 모임 프로필 카드 숫자 (group_profile_card, 0006). 누가 무엇을 못 먹는지는 오지 않는다.
// 소속이 3명 미만이면 tag_counts, food_block_count가 null, 네 글자를 만든 사람이 3명 미만이면 axes가 null
export interface GroupProfileCardData {
  member_count: number;
  tag_counts: { tag: string; count: number }[] | null;
  food_block_count: number | null;
  tested_count: number;
  axes: { explore: number; spicy: number; korean: number; lead: number } | null;
}

export async function getGroupProfileCard(
  groupId: string,
  client: Client = getSupabase()
): Promise<GroupProfileCardData> {
  const { data, error } = await client.rpc('group_profile_card', { p_group_id: groupId });
  if (error) throwServerError(error);
  if (!data) throw new Error('group_profile_card 응답이 비어 있다');
  return data as GroupProfileCardData;
}
