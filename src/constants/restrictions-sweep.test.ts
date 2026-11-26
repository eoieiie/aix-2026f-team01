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

// 0045: 기본 메뉴 40개의 확실과 약함(가게마다), 낱말 표 고침, 오발 막기 더함
const mig45 = read('supabase/migrations/0045_gold_levels.sql');
const arr = (s: string) => (s ? s.split(',') : []);
const LEVELS: Record<string, { sure: string[]; soft: string[] }> = Object.fromEntries(
  [...mig45.slice(mig45.indexOf('from (values'), mig45.indexOf('as v(name, sure, soft)')).matchAll(/\('([^']+)', '\{([a-z,]*)\}', '\{([a-z,]*)\}'\)/g)].map(
    (m) => [m[1], { sure: arr(m[2]), soft: arr(m[3]) }]
  )
);
const softOf = (name: string) => LEVELS[name]?.soft ?? [];
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
  // 약한 표시("들어갈 수 있어요")도 경고로 센다 (0045: 샐러드의 달걀과 유제품은 가게마다)
  it.each(MUST)('%s에는 %s 경고가 있다', (r, m) => {
    expect(warns([...tagsOf(m), ...softOf(m)], r).length).toBeGreaterThan(0);
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
const OLD_KEYWORDS = [...keywordTable(read('supabase/migrations/0008_custom_food.sql')), ...keywordTable(read('supabase/migrations/0014_vegan_egg.sql'))];
const kwBlock45 = mig45.slice(mig45.indexOf('insert into public.food_keywords'), mig45.indexOf('on conflict (keyword) do update'));
const KW45 = new Map([...kwBlock45.matchAll(/\('([^']+)', '\{([a-z,]*)\}', '\{([a-z,]*)\}'\)/g)].map((m) => [m[1], { sure: arr(m[2]), soft: arr(m[3]) }]));
const KEYWORDS: [string, string[]][] = OLD_KEYWORDS.filter(([k]) => !KW45.has(k)).concat([...KW45].map(([k, v]) => [k, v.sure] as [string, string[]]));
const KW_SOFT: [string, string[]][] = [...KW45].map(([k, v]) => [k, v.soft]);
const skipRows = (sql: string) => {
  const at = sql.indexOf('insert into public.food_keyword_skips');
  const block = sql.slice(at, sql.indexOf('on conflict do nothing', at));
  return [...block.matchAll(/\('([^']+)', '([^']+)'\)/g)].map((m) => [m[1], m[2]] as [string, string]);
};
// 0060: 식단 이름(비건, 채식 등)이면 낱말 표의 고기, 해산물, 유제품, 달걀을 약함으로 내리고, 짧은 낱말 오발 막기를 더한다
const mig60 = read('supabase/migrations/0060_word_table_diet_names.sql');
const SKIPS = [...skipRows(mig44), ...skipRows(mig45), ...skipRows(mig60)];
const dietAt = mig60.indexOf('insert into public.food_diet_words');
const DIET_WORDS = [...mig60.slice(dietAt, mig60.indexOf('on conflict do nothing', dietAt)).matchAll(/\('([^']+)'\)/g)].map((m) => m[1]);
const DIET_SOFT = arr(/select '\{([a-z,]+)\}'::text\[\] \$\$/.exec(mig60)![1]);
function isDietName(name: string): boolean {
  const n = name.replace(/ /g, '').toLowerCase();
  return DIET_WORDS.some((w) => SKIPS.filter(([k]) => k === w).map(([, inside]) => inside).reduce((s, x) => s.split(x).join(' '), n).includes(w));
}

function guess(name: string, useSkips = true): string[] {
  const raw = wordTags(name, useSkips);
  return useSkips && isDietName(name) ? raw.filter((t) => !DIET_SOFT.includes(t)) : raw;
}

function wordTags(name: string, useSkips = true): string[] {
  const strip = (word: string) =>
    (useSkips ? SKIPS.filter(([k]) => k === word).map(([, inside]) => inside) : []).reduce((s, w) => s.split(w).join(' '), name);
  const tags = new Set<string>();
  for (const b of BASE) if (strip(b.name).includes(b.name)) b.tags.forEach((t) => tags.add(t));
  // useSkips = false는 0044 전(오발 막기도, 0045 낱말 고침도 없던 때)
  for (const [k, ts] of useSkips ? KEYWORDS : OLD_KEYWORDS) if (strip(k).includes(k)) ts.forEach((t) => tags.add(t));
  return [...tags].sort();
}

// 서버 guess_food_soft_tags 흉내 (0045): 이름에 든 기본 메뉴와 낱말의 약한 태그 중 확실에 없는 것
function guessSoft(name: string): string[] {
  const strip = (word: string) => SKIPS.filter(([k]) => k === word).map(([, inside]) => inside).reduce((s, w) => s.split(w).join(' '), name);
  const sure = guess(name);
  const tags = new Set<string>();
  for (const b of BASE) if (strip(b.name).includes(b.name)) softOf(b.name).forEach((t) => tags.add(t));
  for (const [k, ts] of KW_SOFT) if (strip(k).includes(k)) ts.forEach((t) => tags.add(t));
  if (isDietName(name)) wordTags(name).filter((t) => DIET_SOFT.includes(t)).forEach((t) => tags.add(t));
  return [...tags].filter((t) => !sure.includes(t)).sort();
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

// 기준 정답(python/data/consensus.csv, AI 평가자 둘 + 판정자 하나의 합의)과 기본 메뉴 태그 (0045)
describe('기본 메뉴 태그는 기준 정답을 따른다 (0045)', () => {
  const gold = read('python/data/consensus.csv').trim().split('\n');
  const head = gold[0].split(',');
  const rows = gold.slice(1).map((l) => l.split(',')).filter((c) => c[0].startsWith('B'));
  const TAG_CODES = INGREDIENT_TAGS.map((t) => t.code);
  // 정답 2지만 PR #122 상식 목록과 부딪혀 약함으로만 둔 칸 (사람 확인 필요)
  const HELD: [string, string][] = [['규동', 'seafood']];
  it('40개 모두 0045 값이 있고 seed 확실 태그와 같다', () => {
    expect(rows).toHaveLength(40);
    for (const b of BASE) expect([b.name, [...b.tags].sort()]).toEqual([b.name, [...LEVELS[b.name].sure].sort()]);
  });
  it.each(rows.map((c) => [c[1], c] as [string, string[]]))('%s: 확실은 정답 2, 약함은 정답 1(또는 보류한 2)', (name, c) => {
    const lv = LEVELS[name];
    for (const t of TAG_CODES) {
      const g = c[head.indexOf(t)];
      const held = HELD.some(([n, x]) => n === name && x === t);
      if (lv.sure.includes(t)) expect([name, t, g]).toEqual([name, t, '2']);
      if (lv.soft.includes(t)) expect([name, t, held ? '2' : '1']).toEqual([name, t, g]);
      if (g === '2' && !held) expect([name, t, lv.sure.includes(t)]).toEqual([name, t, true]);
    }
  });
  it('확실과 약함은 겹치지 않는다', () => {
    for (const [name, lv] of Object.entries(LEVELS)) expect([name, lv.sure.filter((t) => lv.soft.includes(t))]).toEqual([name, []]);
  });
});

describe('낱말 표 두 단계 (0045)', () => {
  it('이름만으로 하나로 안 정해지는 낱말은 약하게', () => {
    expect(guess('갈비탕')).not.toContain('beef');
    expect(guessSoft('갈비탕')).toEqual(expect.arrayContaining(['beef', 'pork']));
    expect(guess('돼지갈비')).toContain('pork');
    expect(guess('치킨버거')).not.toContain('beef');
    expect(guessSoft('치킨버거')).toContain('beef');
    expect(guess('해물파전')).toContain('seafood');
    expect(guessSoft('파전')).toContain('seafood');
    expect(guess('탕수육 세트')).not.toContain('wheat');
    expect(guessSoft('탕수육 세트')).toContain('wheat');
  });
  it('오발 막기를 더했다', () => {
    expect(guess('베트남 쌀면')).not.toContain('wheat');
    expect(guess('당면 볶음')).not.toContain('wheat');
    expect(guess('연어스테이크')).not.toContain('beef');
    expect(guess('치킨스테이크')).not.toContain('beef');
    expect(guess('찹스테이크')).toContain('beef');
  });
  it('기본 메뉴 이름이 든 직접 적은 메뉴는 그 메뉴의 약함을 이어받는다', () => {
    expect(guessSoft('부대찌개 2인')).toEqual(expect.arrayContaining(['beef', 'dairy', 'seafood']));
    expect(guess('부대찌개 2인')).not.toContain('dairy');
  });
});

describe('낱말 표 오발: 식단 이름과 짧은 낱말 (0060)', () => {
  // 2차 메뉴 40개(consensus2.csv)에서 낱말 표가 붙인 "괜히 붙은 확실 경고" 4칸
  it.each([
    ['굴라쉬', 'seafood'],
    ['비건 라멘', 'pork'],
    ['채식 만두', 'pork'],
    ['콩고기 불고기', 'beef'],
  ])('%s에는 %s 확실 경고가 없다', (name, bad) => {
    expect(guess(name)).not.toContain(bad);
    expect(wordTags(name, false)).toContain(bad);
  });
  it('식단 이름의 고기, 해산물, 유제품, 달걀은 지우지 않고 약함으로', () => {
    expect(guessSoft('비건 라멘')).toEqual(expect.arrayContaining(['egg', 'pork']));
    expect(guessSoft('채식 만두')).toContain('pork');
    expect(guessSoft('콩고기 불고기')).toContain('beef');
    expect(guessSoft('비건 크림 파스타')).toContain('dairy');
    expect(guess('비건 라멘')).toEqual(['wheat']);
  });
  it('식단 이름이 아니면 그대로, 짧은 낱말도 진짜 음식은 그대로', () => {
    expect(isDietName('야채 식빵')).toBe(false);
    expect(isDietName('VEGAN 버거')).toBe(true);
    expect(guess('김치만두')).toContain('pork');
    expect(guess('굴국밥')).toContain('seafood');
    expect(guess('물회')).toContain('seafood');
    expect(guess('회과육')).not.toContain('seafood');
    expect(guess('돼지감자 볶음')).not.toContain('pork');
  });
});
