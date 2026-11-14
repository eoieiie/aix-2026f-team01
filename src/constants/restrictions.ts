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

// 식단 3개. 재료 묶음으로 판정한다(0012, 비건 달걀은 0014). 그 재료가 든 후보에 "못 먹는 사람이 있어요"가 붙는다
export const DIET_TAGS = [
  { code: 'halal', label: '할랄' },
  { code: 'vegetarian', label: '채식' },
  { code: 'vegan', label: '비건' },
] as const;

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
