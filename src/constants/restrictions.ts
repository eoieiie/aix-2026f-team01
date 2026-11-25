// 못 먹는 것 태그 (spec.md 4-7). 코드는 서버(supabase/migrations의 ingredient_tags, diet_tags)와 같아야 한다.
// 서버 값과 같은지는 restrictions.test.ts가 확인한다. 이유(알레르기 등)는 받지 않는다 (2026-11-02, 0007)

// 재료 9개. 이 재료가 든 후보에는 "못 먹는 사람이 있어요"가 붙는다 (0010부터 빠지지 않는다)
export const INGREDIENT_TAGS = [
  { code: 'spicy', label: '맵기' },
  { code: 'seafood', label: '해산물' },
  { code: 'pork', label: '돼지고기' },
  { code: 'beef', label: '소고기' },
  { code: 'chicken', label: '닭고기' },
  { code: 'wheat', label: '밀가루' },
  { code: 'dairy', label: '유제품' },
  { code: 'nuts', label: '견과류' },
  { code: 'egg', label: '달걀' },
] as const;

// 식단 5개. 재료 묶음으로 판정한다(0012, 비건 달걀은 0014, 힌두교와 페스코는 0044). 그 재료가 든 후보에 "못 먹는 사람이 있어요"가 붙는다
// 재료 태그로 판단할 수 있는 것만 둔다. 할랄의 술(맛술)과 도축 방식은 앱이 모른다(HALAL_NOTE)
export const DIET_TAGS = [
  { code: 'halal', label: '할랄' },
  { code: 'hindu', label: '힌두교' },
  { code: 'vegetarian', label: '채식' },
  { code: 'pescatarian', label: '페스코' },
  { code: 'vegan', label: '비건' },
] as const;

// 서버 diet_ingredients와 같다 (restrictions-sweep.test.ts가 0044 SQL과 비교)
export const DIET_INGREDIENTS: Record<string, string[]> = {
  halal: ['pork'],
  hindu: ['beef'],
  pescatarian: ['pork', 'beef', 'chicken'],
  vegetarian: ['pork', 'beef', 'chicken', 'seafood'],
  vegan: ['pork', 'beef', 'chicken', 'seafood', 'dairy', 'egg'],
};

// 고른 못 먹는 것(재료나 식단)을 재료 태그로 푼다
export function restrictionIngredients(tag: string): string[] {
  return DIET_INGREDIENTS[tag] ?? [tag];
}

// 할랄을 고를 때 한 번 보이는 한 줄
export const HALAL_NOTE = '돼지고기만 알려 줘요. 술(맛술)과 도축 방식은 가게에 물어보세요';

const labelOf = (code: string) => INGREDIENT_TAGS.find((t) => t.code === code)?.label;

// 투표 화면 위 안내 문구. 서버(0012부터)는 식단을 재료로 풀어서 주므로 재료와 음식 이름만 다룬다
export function cantEatNotice(tags: string[], foods: string[]): string[] {
  const items = [
    ...tags.map(labelOf).filter((x): x is NonNullable<typeof x> => !!x),
    ...foods,
  ];
  const lines: string[] = [];
  if (items.length > 0) lines.push(`${items.join(', ')} 못 먹는 사람이 있어요`);
  return lines;
}

// 약한 표시 (0044): AI만 추정한 재료가 이 판 누군가의 못 먹는 것에 걸릴 때. 확인을 권하는 말로만 쓴다
export function maybeLine(tags: string[]): string | null {
  const items = tags.map(labelOf).filter((x): x is NonNullable<typeof x> => !!x);
  return items.length > 0 ? `${items.join(', ')} 들어갈 수 있어요` : null;
}

// 투표 화면 위 약한 안내. 확실한 안내에 이미 나온 재료는 빼고 한 줄로
export function maybeNotice(maybeTags: string[], sureTags: string[]): string | null {
  const rest = [...new Set(maybeTags)].filter((t) => !sureTags.includes(t));
  const line = maybeLine(INGREDIENT_TAGS.map((t) => t.code).filter((c) => rest.includes(c)));
  return line ? `${line}. 가게에 확인해 보세요` : null;
}
