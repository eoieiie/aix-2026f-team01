import {
  buildRequestBody,
  INGREDIENT_TAG_CODES,
  nameKey,
  parseGuess,
} from '../../supabase/functions/guess-ingredients/logic';
import { INGREDIENT_TAGS } from '@/constants/restrictions';

// 명세 4-22: 재료 태그 밖 값은 버린다, 보내는 본문에 메뉴 이름만, 같은 이름 키
describe('AI 재료 추정 로직', () => {
  it('재료 태그 9개가 앱 태그와 같다', () => {
    expect([...INGREDIENT_TAG_CODES]).toEqual(INGREDIENT_TAGS.map((t) => t.code));
  });

  it('9개 밖 태그와 겹친 태그는 버리고, 이유는 남긴 태그만', () => {
    const raw = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  versions: ['a'],
                  tags: [
                    { tag: 'seafood', why: '젓갈이 들어가는 경우가 많아요' },
                    { tag: 'halal', why: 'x' },
                    { tag: 'Pork', why: '' },
                    { tag: 'seafood', why: '두 번' },
                    { tag: 'gluten', why: 'y' },
                  ],
                }),
              },
            ],
          },
        },
      ],
    };
    const g = parseGuess(raw);
    expect(g.tags).toEqual(['seafood', 'pork']);
    expect(g.notes).toEqual({ seafood: '두 번' });
  });

  it('깨진 답이면 아무 태그도 없다', () => {
    expect(parseGuess({ candidates: [{ content: { parts: [{ text: '{oops' }] } }] })).toEqual({ tags: [], notes: {} });
    expect(parseGuess(null)).toEqual({ tags: [], notes: {} });
  });

  it('보내는 본문에는 메뉴 이름 한 줄만 들어간다', () => {
    const body = buildRequestBody('  마라 로제 떡볶이 ');
    expect(body.contents).toEqual([{ role: 'user', parts: [{ text: '마라 로제 떡볶이' }] }]);
    const text = JSON.stringify(body);
    expect(text).not.toMatch(/user_id|session|group|restriction/);
  });

  it('이름 키는 공백을 빼고 소문자', () => {
    expect(nameKey(' 마라 로제  떡볶이')).toBe('마라로제떡볶이');
    expect(nameKey('Pho Bo')).toBe('phobo');
  });
});
