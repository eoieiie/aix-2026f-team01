// 시안 나 "음식 색이 보이는 카드" (2026-11-26). 음식 그림에서 뽑은 색 일곱 가지를 아주 옅게 카드 면에 입힌다.
// 면(tint-*)은 글자 대비 4.5:1 이상이 되게 옅게, 작은 점(dot-*)은 칩과 구역 제목의 표시에만 쓴다.
// 클래스 이름을 문자열로 다 적어 둬야 Tailwind가 찾는다
import colors from '@/constants/colors.json';

export type Tint = 'chili' | 'salmon' | 'gold' | 'green' | 'brown' | 'cold' | 'warm';

export const TINT_BG: Record<Tint, string> = {
  chili: 'bg-tint-chili',
  salmon: 'bg-tint-salmon',
  gold: 'bg-tint-gold',
  green: 'bg-tint-green',
  brown: 'bg-tint-brown',
  cold: 'bg-tint-cold',
  warm: 'bg-tint-warm',
};

export const TINT_DOT: Record<Tint, string> = {
  chili: 'bg-dot-chili',
  salmon: 'bg-dot-salmon',
  gold: 'bg-dot-gold',
  green: 'bg-dot-green',
  brown: 'bg-dot-brown',
  cold: 'bg-dot-cold',
  warm: 'bg-dot-warm',
};

// 기본 음식 40개(id)의 색. 붉은 국물과 볶음은 살구, 초밥과 새우는 연어, 튀김과 빵은 노랑, 채소는 초록,
// 간장과 고기는 갈색, 찬 국수는 하늘, 맑은 국물과 크림은 따뜻한 중립. 표에 없는 음식(직접 적은 메뉴)은 중립
const FOOD_TINT: Record<number, Tint> = {
  1: 'chili', 3: 'chili', 4: 'chili', 5: 'chili', 8: 'chili', 10: 'chili', 16: 'chili', 19: 'chili', 20: 'chili', 22: 'chili', 24: 'chili',
  25: 'salmon', 31: 'salmon', 38: 'salmon',
  23: 'gold', 26: 'gold', 30: 'gold', 33: 'gold', 34: 'gold', 36: 'gold', 39: 'gold', 40: 'gold',
  6: 'green', 17: 'green', 35: 'green', 37: 'green',
  2: 'brown', 7: 'brown', 9: 'brown', 21: 'brown', 29: 'brown',
  12: 'cold', 18: 'cold',
  11: 'warm', 13: 'warm', 14: 'warm', 15: 'warm', 27: 'warm', 28: 'warm', 32: 'warm',
};

export function foodTint(foodId: number | null | undefined): Tint {
  return (foodId != null && FOOD_TINT[foodId]) || 'warm';
}

// 가게는 종류로 고른다. 한식 살구, 중식 갈색, 일식 연어, 양식 노랑, 아시안 초록, 카페와 모르는 종류는 중립
const SHOP_TINT: Record<string, Tint> = {
  korean: 'chili',
  chinese: 'brown',
  japanese: 'salmon',
  western: 'gold',
  asian: 'green',
};

export function shopTint(cuisine: string | null | undefined): Tint {
  return (cuisine && SHOP_TINT[cuisine]) || 'warm';
}

// SVG처럼 className을 못 받는 곳에서 쓰는 면 색 값
export function tintValue(tint: Tint): string {
  return colors[`tint-${tint}` as keyof typeof colors];
}
