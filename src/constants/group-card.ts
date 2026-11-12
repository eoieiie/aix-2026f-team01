import { DIET_TAGS, INGREDIENT_TAGS } from '@/constants/restrictions';

// 4-16 모임 프로필 카드에 보일 줄을 숫자에서 만든다. 화면 부품(src/components/group-profile-card.tsx)은 이것을 그리기만 한다.
// 누가 무엇을 못 먹는지는 서버가 주지 않고 여기서도 만들지 않는다. 인원수만 다룬다

export type GroupCardInput = {
  member_count: number;
  tag_counts: { tag: string; count: number }[] | null;
  food_block_count: number | null;
  tested_count: number;
  axes: { explore: number; spicy: number; korean: number; lead: number } | null;
};

// 식단은 재료로 읽히게 쓴다 (2026-11-12 결정, 0012: 할랄은 돼지고기, 채식은 고기와 해산물, 비건은 거기에 유제품).
// "할랄 1명"보다 무엇을 피하면 되는지가 먼저 보이게 한다
const DIET_AS_INGREDIENTS: Record<string, string> = {
  halal: '돼지고기 (할랄)',
  vegetarian: '고기, 해산물 (채식)',
  vegan: '고기, 해산물, 유제품 (비건)',
};

// 서버에 태그가 먼저 생기고 앱 상수가 늦게 들어와도 코드가 그대로 보이지 않게 (#39의 달걀)
const EXTRA_LABELS: Record<string, string> = { egg: '달걀' };

export function tagLabel(code: string): string {
  return (
    DIET_AS_INGREDIENTS[code] ??
    INGREDIENT_TAGS.find((t) => t.code === code)?.label ??
    DIET_TAGS.find((t) => t.code === code)?.label ??
    EXTRA_LABELS[code] ??
    code
  );
}

// 네 축. 앞 글자 쪽이 +1 (명세 4-14, 5절 "축 점수"). #40의 src/constants/quiz.ts가 들어오면 거기 이름으로 바꾼다
export const GROUP_CARD_AXES = [
  { key: 'explore', left: '탐험', right: '반복' },
  { key: 'spicy', left: '매운맛', right: '순한맛' },
  { key: 'korean', left: '한식', right: '외국음식' },
  { key: 'lead', left: '주도', right: '수용' },
] as const;

export const GROUP_CARD_MIN_PEOPLE = 3;

export type RestrictionView =
  | { kind: 'hidden'; text: string }
  | { kind: 'none'; text: string }
  | { kind: 'rows'; rows: { tag: string; label: string; count: number; ratio: number }[]; foodBlockCount: number };

export type AxesView =
  | { kind: 'hidden'; text: string }
  | { kind: 'rows'; tested: number; rows: { key: string; left: string; right: string; value: number }[] };

export function restrictionView(card: GroupCardInput): RestrictionView {
  if (card.tag_counts === null) return { kind: 'hidden', text: '세 명 이상 모이면 보여요' };
  const foodBlockCount = card.food_block_count ?? 0;
  const tags = card.tag_counts.filter((t) => t.count > 0);
  if (tags.length === 0 && foodBlockCount === 0) {
    return { kind: 'none', text: '못 먹는 것이 있는 사람이 없어요' };
  }
  const total = Math.max(1, card.member_count);
  return {
    kind: 'rows',
    // 서버가 많은 순, 같으면 태그 코드 순으로 준다. 한 번 더 맞춰 둔다
    rows: tags
      .slice()
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
      .map((t) => ({ tag: t.tag, label: tagLabel(t.tag), count: t.count, ratio: Math.min(1, t.count / total) })),
    foodBlockCount,
  };
}

export function axesView(card: GroupCardInput): AxesView {
  if (card.axes === null) return { kind: 'hidden', text: '세 명 이상 네 글자를 만들면 보여요' };
  const axes = card.axes;
  return {
    kind: 'rows',
    tested: card.tested_count,
    rows: GROUP_CARD_AXES.map((a) => ({
      key: a.key,
      left: a.left,
      right: a.right,
      value: Math.max(-1, Math.min(1, Number(axes[a.key]) || 0)),
    })),
  };
}
