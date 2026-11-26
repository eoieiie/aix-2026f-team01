import { View } from 'react-native';

import { TINT_DOT, type Tint } from '@/constants/food-tint';

// 시안 나: 구역 제목과 종류 칩 앞의 작은 음식 색 표시. 글을 대신하지 않고 읽기 프로그램은 건너뛴다
export function TintMark({ tint, size = 12 }: { tint: Tint; size?: 8 | 12 }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={`rounded-full ${TINT_DOT[tint]}`}
      style={{ width: size, height: size }}
    />
  );
}
