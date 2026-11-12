import type { Client } from './groups';
import { getSupabase } from './supabase';

// 못 먹는 것 (spec.md 4-7). 사람에 붙고, 저장하면 내가 속한 모든 모임에 적용된다.
// 서버 함수 get_my_restrictions, set_my_restrictions를 부른다. 이유(알레르기 등)는 받지 않는다 (0007)

// 태그 하나 또는 음식 하나. 서버 표(restrictions)도 둘 중 하나만 가진다
export type RestrictionItem = { tag: string; foodId: null } | { tag: null; foodId: number };

export class RestrictionError extends Error {
  constructor(public readonly code: string) {
    super(code === 'invalid_items' ? '저장하지 못했어요. 고른 것을 확인해 주세요' : code);
    this.name = 'RestrictionError';
  }
}

// 화면에 보일 문구. 서버 코드가 아니면(네트워크 등) "연결할 수 없어요"
export function restrictionErrorMessage(error: unknown): string {
  if (error instanceof RestrictionError) return error.message;
  return '연결할 수 없어요';
}

export function itemKey(item: RestrictionItem): string {
  return item.tag !== null ? `tag:${item.tag}` : `food:${item.foodId}`;
}

// 누르면 고르고, 다시 누르면 뺀다
export function toggleItem(
  items: RestrictionItem[],
  target: { tag: string } | { foodId: number },
): RestrictionItem[] {
  const next: RestrictionItem =
    'tag' in target ? { tag: target.tag, foodId: null } : { tag: null, foodId: target.foodId };
  const key = itemKey(next);
  return items.some((i) => itemKey(i) === key)
    ? items.filter((i) => itemKey(i) !== key)
    : [...items, next];
}

// 서버 p_items 형식. 예: [{"tag":"seafood"},{"food_id":3}]
export function toPayload(items: RestrictionItem[]) {
  return items.map((i) => (i.tag !== null ? { tag: i.tag } : { food_id: i.foodId }));
}

export async function getMyRestrictions(client: Client = getSupabase()): Promise<RestrictionItem[]> {
  const { data, error } = await client.rpc('get_my_restrictions');
  if (error) throw error;
  return (data ?? []).map((r: any) =>
    r.tag !== null ? { tag: r.tag, foodId: null } : { tag: null, foodId: r.food_id },
  );
}

// 전체를 바꾼다. 빈 배열이면 전부 해제. 실패하면 서버에 예전 값이 그대로 남는다.
// 서버가 내가 참여한 진행 중인 판의 후보를 다시 판정한다
export async function saveMyRestrictions(
  items: RestrictionItem[],
  client: Client = getSupabase(),
): Promise<void> {
  const { error } = await client.rpc('set_my_restrictions', { p_items: toPayload(items) });
  if (error) {
    if (error.message === 'invalid_items') throw new RestrictionError('invalid_items');
    throw error;
  }
}
