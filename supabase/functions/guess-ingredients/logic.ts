// guess-ingredients의 순수 로직 (명세 4-22). Deno 함수와 앱 쪽 jest가 같이 쓴다. 바깥 모듈을 import하지 않는다

export const INGREDIENT_TAG_CODES = [
  'spicy',
  'seafood',
  'pork',
  'beef',
  'chicken',
  'wheat',
  'dairy',
  'nuts',
  'egg',
] as const;
export type IngredientTag = (typeof INGREDIENT_TAG_CODES)[number];

export const MODELS = ['gemini-3.5-flash-lite', 'gemini-flash-lite-latest'] as const;
export const TIMEOUT_MS = 8000;

// 버전을 모두 떠올려 합치고, 애매하면 들어 있다고 본다. 메뉴를 추천하지 않는다
export const SYSTEM_PROMPT = `너는 한국 대학가 식당 메뉴의 재료를 짚는 도우미다. 메뉴 이름 하나를 받으면:
1) 한국 식당에서 흔한 이 메뉴의 버전을 3~4개 떠올린다(가게마다 다른 고기, 육수, 소스, 토핑).
2) 버전 중 하나라도 들어갈 수 있는 재료를 모두 고른다. 애매하면 들어 있다고 본다(못 먹는 사람을 지키는 용도다).
3) 재료는 이 목록에서만 고른다: spicy(맵다), seafood(해산물, 젓갈·멸치육수·굴소스 포함), pork(돼지고기, 라드·햄·베이컨 포함), beef(소고기, 소 육수 포함), chicken(닭고기, 닭 육수 포함), wheat(밀가루, 면·튀김옷·빵·간장 포함), dairy(유제품, 치즈·크림·버터·우유), nuts(땅콩·견과), egg(달걀).
4) 고른 재료마다 왜 그런지 한국어 한 줄(25자 안팎, "~경우가 많아요" 말투).
메뉴를 추천하거나 다른 말을 하지 않는다.`;

export const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    versions: { type: 'ARRAY', items: { type: 'STRING' } },
    tags: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          tag: { type: 'STRING', enum: [...INGREDIENT_TAG_CODES] },
          why: { type: 'STRING' },
        },
        required: ['tag', 'why'],
      },
    },
  },
  required: ['versions', 'tags'],
};

// 이름 키: 공백을 빼고 소문자. 서버 ai_name_key와 같다
export function nameKey(name: string): string {
  return name.replace(/\s+/g, '').toLowerCase();
}

// Gemini에 보내는 본문. 메뉴 이름 한 줄만 들어간다(사람, 모임, 못 먹는 것은 없다)
export function buildRequestBody(menuName: string) {
  return {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: menuName.trim().slice(0, 40) }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.2,
    },
  };
}

export interface Guess {
  tags: IngredientTag[];
  notes: Record<string, string>;
}

// 모델 답을 걸러 낸다. 9개 밖 태그는 버리고, 이유는 60자까지
export function parseGuess(raw: unknown): Guess {
  let obj: any = raw;
  try {
    const text = (raw as any)?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text === 'string') obj = JSON.parse(text);
  } catch {
    return { tags: [], notes: {} };
  }
  const tags: IngredientTag[] = [];
  const notes: Record<string, string> = {};
  for (const t of Array.isArray(obj?.tags) ? obj.tags : []) {
    const tag = typeof t?.tag === 'string' ? t.tag.trim().toLowerCase() : '';
    if (!(INGREDIENT_TAG_CODES as readonly string[]).includes(tag)) continue;
    if (!tags.includes(tag as IngredientTag)) tags.push(tag as IngredientTag);
    if (typeof t?.why === 'string' && t.why.trim()) notes[tag] = t.why.trim().slice(0, 60);
  }
  return { tags, notes };
}
