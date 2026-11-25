import * as fs from 'fs';
import * as path from 'path';

import { aiFields } from '@/api/sessions';
import {
  cantEatNotice,
  DIET_INGREDIENTS,
  DIET_TAGS,
  INGREDIENT_TAGS,
  maybeLine,
  maybeNotice,
  restrictionIngredients,
} from './restrictions';

// 엉뚱한 경고 시험 (0044, 병주 "괜찮은데 안 괜찮아지는 버그가 있으면 안 됨").
// 기본 메뉴 40개 x 못 먹는 것 14개(재료 9 + 식단 5)를 모두 돌려, 확실 경고가 상식에 맞는지 본다.
// 직접 적은 메뉴는 서버 낱말 표(0008, 0014)와 오발 막기(0044)를 그대로 흉내 내 본다
const root = path.join(__dirname, '..', '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

const seed = read('supabase/seed/0001_foods.sql');
const BASE: { name: string; tags: string[] }[] = [...seed.matchAll(/\('([^']+)', '[^']*', array\[([^\]]*)\]/g)].map((m) => ({
  name: m[1],
  tags: m[2].split(',').map((t) => t.trim().replace(/'/g, '')).filter((t) => INGREDIENT_TAGS.some((x) => x.code === t)),
}));
const tagsOf = (name: string) => BASE.find((b) => b.name === name)!.tags;
const RESTRICTIONS = [...INGREDIENT_TAGS.map((t) => t.code), ...DIET_TAGS.map((t) => t.code)];
const warns = (foodTags: string[], r: string) => foodTags.filter((t) => restrictionIngredients(r).includes(t));

const mig44 = read('supabase/migrations/0044_two_level_warnings.sql');

describe('식단 묶음은 서버와 같다 (0044)', () => {
  it('식단 코드', () => {
    const m = mig44.match(/diet_tags\(\) returns text\[\][\s\S]*?array\[([^\]]+)\]/)!;
    expect(m[1].split(',').map((s) => s.trim().replace(/'/g, '')).sort()).toEqual(DIET_TAGS.map((t) => t.code).sort());
  });
  it('식단마다 재료 묶음', () => {
    const block = mig44.slice(mig44.indexOf('function public.diet_ingredients'));
    const server = Object.fromEntries(
      [...block.slice(0, block.indexOf('end\n')).matchAll(/when '(\w+)' then array\[([^\]]+)\]/g)].map((m) => [
        m[1],
        m[2].split(',').map((s) => s.trim().replace(/'/g, '')),
      ])
    );
    expect(server).toEqual(DIET_INGREDIENTS);
  });
  it('할랄은 돼지고기만, 힌두교는 소고기, 페스코는 해산물을 먹는다', () => {
    expect(restrictionIngredients('halal')).toEqual(['pork']);
    expect(restrictionIngredients('hindu')).toEqual(['beef']);
    expect(restrictionIngredients('pescatarian')).not.toContain('seafood');
  });
});

describe('기본 메뉴 40개 x 못 먹는 것 14개', () => {
  it('메뉴 40개와 조합 560개', () => {
    expect(BASE).toHaveLength(40);
    expect(BASE.length * RESTRICTIONS.length).toBe(560);
  });

  // 상식으로 경고가 없어야 하는 조합. 하나라도 걸리면 기본 메뉴 태그나 식단 묶음이 과한 것이다
  const MUST_NOT: Record<string, string[]> = {
    halal: ['불고기', '규동', '설렁탕', '삼계탕', '치킨', '쌀국수', '초밥', '닭갈비', '된장찌개', '콩국수'],
    hindu: ['삼겹살', '제육볶음', '돼지국밥', '치킨', '초밥', '닭갈비', '돈까스'],
    pescatarian: ['초밥', '칼국수', '우동', '된장찌개', '콩국수', '토마토 파스타', '팟타이'],
    vegetarian: ['콩국수', '토마토 파스타', '샐러드'],
    vegan: ['콩국수'],
    spicy: ['짜장면', '불고기', '삼계탕', '돈까스', '크림 파스타', '우동', '초밥', '설렁탕', '물냉면', '콩국수', '탕수육', '규동', '삼겹살', '된장찌개'],
    seafood: ['불고기', '삼겹살', '제육볶음', '삼계탕', '돈까스', '탕수육', '규동', '짜장면', '닭갈비'],
    pork: ['불고기', '삼계탕', '초밥', '규동', '비빔밥', '설렁탕', '닭갈비', '치킨', '물냉면'],
    beef: ['삼겹살', '제육볶음', '돈까스', '삼계탕', '닭갈비', '짜장면', '초밥'],
    chicken: ['삼겹살', '불고기', '김치찌개', '짜장면', '초밥'],
    wheat: ['삼겹살', '불고기', '삼계탕', '비빔밥', '초밥'],
    dairy: ['김치찌개', '비빔밥', '짜장면', '불고기', '초밥', '삼겹살'],
    nuts: ['김밥', '짜장면', '불고기', '초밥', '삼겹살', '비빔밥'],
    egg: ['불고기', '삼겹살', '제육볶음', '짜장면', '삼계탕'],
  };
  for (const [r, menus] of Object.entries(MUST_NOT)) {
    it(`${r}: ${menus.length}개 메뉴에 엉뚱한 경고가 없다`, () => {
      for (const m of menus) expect([m, warns(tagsOf(m), r)]).toEqual([m, []]);
    });
  }

  // 반대로 꼭 걸려야 하는 조합 (너무 느슨해지지 않게)
  const MUST: [string, string][] = [
    ['halal', '삼겹살'], ['halal', '돈까스'], ['halal', '짜장면'], ['halal', '탕수육'],
    ['hindu', '불고기'], ['hindu', '규동'], ['hindu', '설렁탕'],
    ['pescatarian', '치킨'], ['pescatarian', '불고기'], ['pescatarian', '삼겹살'],
    ['vegetarian', '초밥'], ['vegan', '피자'], ['vegan', '샐러드'], ['seafood', '초밥'], ['spicy', '떡볶이'],
  ];
  it.each(MUST)('%s에는 %s 경고가 있다', (r, m) => {
    expect(warns(tagsOf(m), r).length).toBeGreaterThan(0);
  });

  it('식단 경고는 그 식단 묶음 재료로만 생긴다', () => {
    for (const b of BASE)
      for (const r of RESTRICTIONS) for (const w of warns(b.tags, r)) expect(restrictionIngredients(r)).toContain(w);
  });
});

// 서버 guess_food_tags 흉내 (0008 + 0014 낱말 표, 0044 오발 막기)
function keywordTable(sql: string): [string, string[]][] {
  const out: [string, string[]][] = [];
  let at = 0;
  for (;;) {
    const i = sql.indexOf('insert into public.food_keywords', at);
    if (i < 0) break;
    const j = sql.indexOf('on conflict', i);
    for (const m of sql.slice(i, j).matchAll(/\('([^']+)', '\{([a-z,]+)\}'\)/g)) out.push([m[1], m[2].split(',')]);
    at = j;
  }
  return out;
}
const KEYWORDS = [...keywordTable(read('supabase/migrations/0008_custom_food.sql')), ...keywordTable(read('supabase/migrations/0014_vegan_egg.sql'))];
const skipBlock = mig44.slice(mig44.indexOf('insert into public.food_keyword_skips'), mig44.indexOf('on conflict do nothing'));
const SKIPS = [...skipBlock.matchAll(/\('([^']+)', '([^']+)'\)/g)].map((m) => [m[1], m[2]] as [string, string]);

function guess(name: string, useSkips = true): string[] {
  const strip = (word: string) =>
    (useSkips ? SKIPS.filter(([k]) => k === word).map(([, inside]) => inside) : []).reduce((s, w) => s.split(w).join(' '), name);
  const tags = new Set<string>();
  for (const b of BASE) if (strip(b.name).includes(b.name)) b.tags.forEach((t) => tags.add(t));
  for (const [k, ts] of KEYWORDS) if (strip(k).includes(k)) ts.forEach((t) => tags.add(t));
  return [...tags].sort();
}

describe('직접 적은 메뉴의 낱말 표 (확실 단계)', () => {
  const WRONG: [string, string[]][] = [
    ['햄버거 세트', ['pork']],
    ['닭갈비 볶음밥', ['beef', 'pork']],
    ['충무김밥', ['pork', 'egg']],
    ['유부초밥', ['seafood']],
    ['쌀국수 곱빼기', ['wheat']],
    ['백김치', ['spicy']],
    ['육회비빔밥', ['seafood']],
    ['회오리 오므라이스', ['seafood']],
    ['치킨돈까스', ['pork']],
    ['규카츠', ['pork']],
    ['에비카츠', ['pork']],
  ];
  it.each(WRONG)('%s에는 %j 확실 경고가 없다', (name, bad) => {
    for (const t of bad) expect(guess(name)).not.toContain(t);
  });
  it('오발 막기 전에는 위 11개가 모두 엉뚱하게 걸렸다 (고친 수)', () => {
    const fixed = WRONG.filter(([name, bad]) => bad.some((t) => guess(name, false).includes(t)));
    expect(fixed).toHaveLength(WRONG.length);
  });
  it('막지 말아야 할 것은 그대로 걸린다', () => {
    expect(guess('햄치즈 토스트')).toContain('pork');
    expect(guess('제육 정식')).toEqual(expect.arrayContaining(['pork', 'spicy']));
    expect(guess('참치김밥')).toContain('seafood');
    expect(guess('치즈돈까스')).toContain('pork');
    expect(guess('회덮밥')).toContain('seafood');
  });
});

describe('두 단계 표시 (0044)', () => {
  it('AI 태그는 확실 태그에 없는 것만 약한 단계로', () => {
    const f = aiFields({
      maybe_tags: ['pork'],
      ai_checked_at: null,
      foods: { tags: ['wheat'], ai_tags: ['pork', 'wheat'], ai_basis: { pork: 'varies' }, ai_status: 'done' },
    });
    expect(f.aiTags).toEqual(['pork']);
    expect(f.sureTags).toEqual(['wheat']);
    expect(f.maybeTags).toEqual(['pork']);
    expect(f.aiBasis.pork).toBe('varies');
    expect(f.aiChecked).toBe(false);
  });
  it('확실은 "못 먹는 사람이 있어요", 약함은 "들어갈 수 있어요"', () => {
    expect(cantEatNotice(['pork'], [])).toEqual(['돼지고기 못 먹는 사람이 있어요']);
    expect(maybeLine(['pork', 'spicy'])).toBe('돼지고기, 맵기 들어갈 수 있어요');
    expect(maybeNotice(['pork', 'spicy', 'pork'], ['pork'])).toBe('맵기 들어갈 수 있어요. 가게에 확인해 보세요');
    expect(maybeNotice([], [])).toBeNull();
  });
});
