import colors from '@/constants/colors.json';

import { foodColorClass, foodColorValues } from './food-dot';
import { countChars } from './text-field';

describe('FoodDot 색 (spec.md 7절, 이슈 #10)', () => {
  it('같은 음식 id면 항상 같은 색이다', () => {
    expect(foodColorClass(3)).toBe(foodColorClass(3));
    expect(foodColorClass(11)).toBe(foodColorClass(3));
  });

  it('id가 이어지는 음식 8개는 색이 모두 다르다', () => {
    const classes = [1, 2, 3, 4, 5, 6, 7, 8].map(foodColorClass);
    expect(new Set(classes).size).toBe(8);
  });

  it('원판에 쓰는 색 값은 같은 음식의 동그라미 토큰 값과 같다', () => {
    for (const id of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const name = foodColorClass(id).replace(/^bg-/, '') as keyof typeof colors;
      expect(foodColorValues(id).fill).toBe(colors[name]);
    }
  });
});

describe('TextField 글자 수 (spec.md 4-2, 4-5)', () => {
  it('한글 한 자를 1자로 센다', () => {
    expect(countChars('김치찌개')).toBe(4);
    expect(countChars('')).toBe(0);
  });
});
