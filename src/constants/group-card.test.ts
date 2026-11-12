import { axesView, restrictionView, tagLabel } from './group-card';

// 4-16 모임 프로필 카드: 숫자에서 보일 줄 만들기
const base = { member_count: 4, tag_counts: [], food_block_count: 0, tested_count: 0, axes: null };

describe('restrictionView', () => {
  it('소속이 3명 미만이면(tag_counts가 null) "세 명 이상 모이면 보여요"', () => {
    expect(restrictionView({ ...base, member_count: 2, tag_counts: null, food_block_count: null })).toEqual({
      kind: 'hidden',
      text: '세 명 이상 모이면 보여요',
    });
  });

  it('아무도 없으면 "못 먹는 것이 있는 사람이 없어요"', () => {
    expect(restrictionView(base).kind).toBe('none');
  });

  it('많은 순, 같으면 태그 코드 순. 0명은 없다. 막대는 소속 수에 대한 비율', () => {
    const v = restrictionView({
      ...base,
      tag_counts: [
        { tag: 'seafood', count: 1 },
        { tag: 'pork', count: 2 },
        { tag: 'beef', count: 1 },
        { tag: 'nuts', count: 0 },
      ],
      food_block_count: 1,
    });
    if (v.kind !== 'rows') throw new Error('rows');
    expect(v.rows.map((r) => [r.label, r.count, r.ratio])).toEqual([
      ['돼지고기', 2, 0.5],
      ['소고기', 1, 0.25],
      ['해산물', 1, 0.25],
    ]);
    expect(v.foodBlockCount).toBe(1);
  });

  it('태그는 없고 음식만 직접 고른 사람이 있으면 줄 없이 그 수만', () => {
    const v = restrictionView({ ...base, food_block_count: 2 });
    expect(v).toEqual({ kind: 'rows', rows: [], foodBlockCount: 2 });
  });
});

describe('tagLabel', () => {
  it('식단은 재료로 읽히게 쓴다', () => {
    expect(tagLabel('halal')).toBe('돼지고기 (할랄)');
    expect(tagLabel('vegetarian')).toBe('고기, 해산물 (채식)');
    expect(tagLabel('spicy')).toBe('맵기');
    expect(tagLabel('egg')).toBe('달걀');
  });
});

describe('axesView', () => {
  it('네 글자를 만든 사람이 3명 미만이면 문구', () => {
    expect(axesView(base)).toEqual({ kind: 'hidden', text: '세 명 이상 네 글자를 만들면 보여요' });
  });

  it('축 순서와 값. -1~1 밖은 자른다', () => {
    const v = axesView({ ...base, tested_count: 3, axes: { explore: 0.33, spicy: -1, korean: 0, lead: 2 } });
    if (v.kind !== 'rows') throw new Error('rows');
    expect(v.tested).toBe(3);
    expect(v.rows.map((r) => [r.left, r.value])).toEqual([
      ['탐험', 0.33],
      ['매운맛', -1],
      ['한식', 0],
      ['주도', 1],
    ]);
  });
});
