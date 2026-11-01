import { View } from 'react-native';

import colors from '@/constants/colors.json';

// 색 값은 tailwind.config.js의 food-1 ~ food-8 토큰에 있다. 클래스 이름을 문자열로 다 적어 둬야 Tailwind가 찾는다
export const FOOD_COLOR_CLASSES = [
  'bg-food-1',
  'bg-food-2',
  'bg-food-3',
  'bg-food-4',
  'bg-food-5',
  'bg-food-6',
  'bg-food-7',
  'bg-food-8',
] as const;

const SIZE_CLASSES = {
  sm: 'h-6 w-6',
  md: 'h-10 w-10',
  lg: 'h-14 w-14',
} as const;

function foodColorIndex(foodId: number) {
  const n = FOOD_COLOR_CLASSES.length;
  return ((foodId % n) + n) % n;
}

// 같은 음식 id면 어느 화면에서나 같은 색이다. id가 이어지는 음식끼리는 색이 겹치지 않는다
export function foodColorClass(foodId: number) {
  return FOOD_COLOR_CLASSES[foodColorIndex(foodId)];
}

// 밝은 색(연한 주황, 회색) 위에는 검정 글자, 진한 색 위에는 흰 글자
const LIGHT_FOOD_COLORS = new Set(['food-3', 'food-4', 'food-6', 'food-7']);

// SVG 원판처럼 className을 못 받는 곳에서 쓴다. 값은 tailwind.config.js와 같은 colors.json
export function foodColorValues(foodId: number) {
  const name = FOOD_COLOR_CLASSES[foodColorIndex(foodId)].replace(/^bg-/, '') as keyof typeof colors;
  return {
    fill: colors[name],
    label: LIGHT_FOOD_COLORS.has(name) ? colors.text : colors['on-primary'],
  };
}

type FoodDotProps = {
  foodId: number;
  size?: keyof typeof SIZE_CLASSES;
  // 화면 읽기 프로그램이 읽을 음식 이름
  name?: string;
};

// 음식은 사진 대신 음식마다 고정된 색 동그라미 (spec.md 7절, 이슈 #10)
export function FoodDot({ foodId, size = 'md', name }: FoodDotProps) {
  return (
    <View
      accessibilityLabel={name}
      className={`rounded-full ${SIZE_CLASSES[size]} ${foodColorClass(foodId)}`}
    />
  );
}
