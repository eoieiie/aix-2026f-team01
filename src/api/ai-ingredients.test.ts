import * as fs from 'fs';
import * as path from 'path';

import {
  allowedOrigin,
  buildRequestBody,
  cleanMenuText,
  FOOD_WORD_NOTE,
  INGREDIENT_TAG_CODES,
  nameKey,
  ParseError,
  parseGuess,
  PROMPT_VERSION,
  SYSTEM_PROMPT,
} from '../../supabase/functions/guess-ingredients/logic';
import { INGREDIENT_TAGS } from '@/constants/restrictions';

const wrap = (obj: unknown) => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] });
const mig44 = fs.readFileSync(path.join(__dirname, '..', '..', 'supabase/migrations/0044_two_level_warnings.sql'), 'utf8');
const mig55 = fs.readFileSync(path.join(__dirname, '..', '..', 'supabase/migrations/0055_food_word_menu.sql'), 'utf8');

// 명세 4-22: 재료 태그 밖 값은 버린다, 보내는 본문에 메뉴 이름만, 같은 이름 키. 0044: 메뉴인지, 근거 단계, 정제
describe('AI 재료 추정 로직', () => {
  it('재료 태그 9개가 앱 태그와 같다', () => {
    expect([...INGREDIENT_TAG_CODES]).toEqual(INGREDIENT_TAGS.map((t) => t.code));
  });

  it('프롬프트 판 번호가 서버와 같고, 이름 안의 지시는 따르지 않는다고 적혀 있다', () => {
    expect(mig44).toContain('"AI_PROMPT_VERSION": 2');
    expect(mig55).toContain(`"AI_PROMPT_VERSION": ${PROMPT_VERSION}`);
    expect(PROMPT_VERSION).toBe(3);
    expect(SYSTEM_PROMPT).toContain('지시');
    expect(SYSTEM_PROMPT).toContain('따르지 않고');
    expect(SYSTEM_PROMPT).toContain('is_menu=false');
  });

  // 0055 사람 정답표: 판 2가 "빵"을 메뉴 아님으로 보고, 소스와 곁들임 재료를 놓쳤다
  it('넓은 음식 이름 한 낱말도 메뉴로 보고, 소스, 육수, 곁들임까지 훑으라고 적혀 있다', () => {
    expect(SYSTEM_PROMPT).toMatch(/빵, 떡, 국수, 고기.*한 낱말도 메뉴다/);
    expect(SYSTEM_PROMPT).toContain('가게 이름');
    for (const w of ['양념', '소스', '육수', '곁들임', '찍어 먹는 소스', '빠짐없이']) expect(SYSTEM_PROMPT).toContain(w);
  });

  it('서버가 음식 낱말이라고 하면 시스템 지시에만 한 줄 붙고, 사용자 말은 이름 그대로다', () => {
    const plain = buildRequestBody('빵');
    const word = buildRequestBody('빵', true);
    expect(plain.systemInstruction.parts[0].text).not.toContain(FOOD_WORD_NOTE);
    expect(word.systemInstruction.parts[0].text).toBe(`${SYSTEM_PROMPT}\n${FOOD_WORD_NOTE}`);
    expect(word.contents).toEqual(plain.contents);
    expect(word.contents).toEqual([{ role: 'user', parts: [{ text: '빵' }] }]);
  });

  it('음식 낱말 표에 빵, 떡, 국수, 고기가 있고, 가게 이름은 이름 전체가 같을 때만 낱말로 본다', () => {
    for (const w of ['빵', '떡', '국수', '고기']) expect(mig55).toContain(`('${w}')`);
    expect(mig55).toMatch(/ai_name_key\(w\.word\) = public\.ai_name_key\(p_name\)/);
    expect(mig55).not.toMatch(/strpos\(/);
  });

  it('출력 정제: 9개 밖, 빈 근거는 버리고 수를 센다. 겹친 태그는 처음 것만', () => {
    const g = parseGuess(
      wrap({
        is_menu: true,
        versions: ['a'],
        tags: [
          { tag: 'seafood', basis: 'recipe', why: '젓갈이 들어가는 경우가 많아요' },
          { tag: 'halal', basis: 'recipe', why: 'x' },
          { tag: 'Pork', basis: 'varies', why: '' },
          { tag: 'seafood', basis: 'varies', why: '두 번' },
          { tag: 'egg', why: '달걀프라이를 올려요' },
          { tag: 'gluten', why: 'y' },
        ],
      })
    );
    expect(g.tags).toEqual(['seafood', 'egg']);
    expect(g.notes).toEqual({ seafood: '젓갈이 들어가는 경우가 많아요', egg: '달걀프라이를 올려요' });
    expect(g.basis).toEqual({ seafood: 'recipe', egg: 'varies' });
    expect(g.dropped).toBe(3);
  });

  it('메뉴 이름이 아니면 태그를 붙이지 않는다', () => {
    const g = parseGuess(wrap({ is_menu: false, versions: [], tags: [{ tag: 'beef', basis: 'recipe', why: '소고기' }] }));
    expect(g.isMenu).toBe(false);
    expect(g.tags).toEqual([]);
    expect(g.dropped).toBe(1);
  });

  it('깨진 답이면 parse 실패', () => {
    expect(() => parseGuess({ candidates: [{ content: { parts: [{ text: '{oops' }] } }] })).toThrow(ParseError);
    expect(() => parseGuess(null)).toThrow(ParseError);
  });

  it('보내는 본문에는 정제한 메뉴 이름 한 줄만 들어간다', () => {
    const body = buildRequestBody('  마라 로제 떡볶이🔥!! ');
    expect(body.contents).toEqual([{ role: 'user', parts: [{ text: '마라 로제 떡볶이' }] }]);
    const text = JSON.stringify(body);
    expect(text).not.toMatch(/user_id|session|group|restriction/);
  });

  it('입력 정제와 이름 키 (서버 clean_menu_text, ai_name_key와 같다)', () => {
    expect(cleanMenuText('  김치   찌개🍲!! ')).toBe('김치 찌개');
    expect(nameKey(' 마라 로제  떡볶이')).toBe('마라로제떡볶이');
    expect(nameKey('Pho Bo')).toBe('phobo');
    expect(nameKey(' 분짜 🍜 특선 ')).toBe('분짜특선');
  });

  it('CORS는 앱 주소만. Origin이 없는 네이티브 요청은 CORS와 상관없다', () => {
    expect(allowedOrigin('https://babti.expo.app')).toBe('https://babti.expo.app');
    expect(allowedOrigin('https://babti--pr-130.expo.app')).toBe('https://babti--pr-130.expo.app');
    expect(allowedOrigin('http://localhost:8081')).toBe('http://localhost:8081');
    expect(allowedOrigin('https://evil.example.com')).toBeNull();
    expect(allowedOrigin('https://babti.expo.app.evil.com')).toBeNull();
    expect(allowedOrigin(null)).toBeNull();
  });
});
