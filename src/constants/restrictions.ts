// 못 먹는 것 태그와 이유 (spec.md 4-7). 코드는 서버(0001_schema.sql)와 같아야 한다.
// 서버 값과 같은지는 restrictions.test.ts가 확인한다

// 재료 8개. 이 재료가 든 후보에는 "못 먹는 사람이 있어요"가 붙는다 (0010부터 빠지지 않는다)
export const INGREDIENT_TAGS = [
  { code: 'spicy', label: '맵기' },
  { code: 'seafood', label: '해산물' },
  { code: 'pork', label: '돼지고기' },
  { code: 'beef', label: '소고기' },
  { code: 'chicken', label: '닭고기' },
  { code: 'wheat', label: '밀가루' },
  { code: 'dairy', label: '유제품' },
  { code: 'nuts', label: '견과류' },
] as const;

// 식단 3개. 음식에 짝 표시(halal_ok 등)가 없으면 "못 먹는 사람이 있어요"가 붙는다
export const DIET_TAGS = [
  { code: 'halal', label: '할랄' },
  { code: 'vegetarian', label: '채식' },
  { code: 'vegan', label: '비건' },
] as const;

// 이유. 판정에는 쓰지 않고 2단계 모임 프로필 집계에만 쓴다. 고르면 '안 먹어요'로 시작한다
export const RESTRICTION_KINDS = [
  { code: 'allergy', label: '알레르기' },
  { code: 'dislike', label: '안 먹어요' },
  { code: 'belief', label: '신념' },
] as const;

export type RestrictionKind = (typeof RESTRICTION_KINDS)[number]['code'];

export const DEFAULT_RESTRICTION_KIND: RestrictionKind = 'dislike';

// 투표 화면 위 안내 문구 (0010). 재료와 음식은 "OO 못 먹는", 식단은 식단마다 다른 말
const DIET_NOTICE: Record<string, string> = {
  halal: '할랄 음식만 먹는',
  vegetarian: '채식하는',
  vegan: '비건인',
};

export function cantEatNotice(tags: string[], foods: string[]): string[] {
  const label = (code: string) => INGREDIENT_TAGS.find((t) => t.code === code)?.label;
  const items = [
    ...tags.map(label).filter((x): x is NonNullable<typeof x> => !!x),
    ...foods,
  ];
  const lines: string[] = [];
  if (items.length > 0) lines.push(`${items.join(', ')} 못 먹는 사람이 있어요`);
  for (const t of tags) if (DIET_NOTICE[t]) lines.push(`${DIET_NOTICE[t]} 사람이 있어요`);
  return lines;
}
