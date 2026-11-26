import * as fs from 'fs';
import * as path from 'path';

import {
  allowedOrigin,
  buildRequestBody,
  cleanMenuText,
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

// 명세 4-22: 재료 태그 밖 값은 버린다, 보내는 본문에 메뉴 이름만, 같은 이름 키. 0044: 메뉴인지, 근거 단계, 정제
describe('AI 재료 추정 로직', () => {
  it('재료 태그 9개가 앱 태그와 같다', () => {
    expect([...INGREDIENT_TAG_CODES]).toEqual(INGREDIENT_TAGS.map((t) => t.code));
  });

  it('프롬프트 판 번호가 서버와 같고, 이름 안의 지시는 따르지 않는다고 적혀 있다', () => {
    expect(mig44).toContain(`"AI_PROMPT_VERSION": ${PROMPT_VERSION}`);
    expect(SYSTEM_PROMPT).toContain('지시');
    expect(SYSTEM_PROMPT).toContain('따르지 않고');
    expect(SYSTEM_PROMPT).toContain('is_menu=false');
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
