import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { FoodThumb } from '@/components/food-thumb';
import colors from '@/constants/colors.json';
import type { PlateFood } from '@/hooks/use-groups';

// 원 하나: 그림 32에 카드 바탕색 고리 2를 더해 36. 옆 원과 10씩 겹친다
const PLATE = 36;
const OVERLAP = 10;
// 사람 동그라미 줄(30 + 고리 2씩 = 34)보다 2 크다. 위아래로 1씩 넘겨 카드 높이를 바꾸지 않는다
const BLEED = (PLATE - 34) / 2;

// 홈 모임 카드 오른쪽 아래, 그 모임이 같이 먹은 음식 (docs/design.md "홈 모임 카드 꾸밈", 2026-11-26 병주 1안).
// foods는 최근 순. 그릴 때는 최근 것이 오른쪽에 오도록 뒤집고, 왼쪽으로 갈수록 카드 바탕색으로 흐려진다.
// 기록이 없으면 같은 자리에 점선 빈 접시 둘. 꾸밈이라 화면 읽기 프로그램에는 숨긴다(카드 글이 이미 메뉴를 말한다)
// 시안 나: 카드 면이 음식 색이면 back에 그 색 값을 준다. 고리와 흐림이 카드 면과 같아야 네모가 비치지 않는다
export function PlateFoods({ foods, back = colors.surface }: { foods: PlateFood[]; back?: string }) {
  if (foods.length === 0) {
    return (
      <View
        className="flex-row gap-1"
        style={{ marginVertical: -BLEED }}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        {[0, 1].map((i) => (
          <Svg key={i} width={PLATE} height={PLATE}>
            <Circle
              cx={PLATE / 2}
              cy={PLATE / 2}
              r={PLATE / 2 - 1}
              fill="none"
              stroke={colors['surface-strong']}
              strokeWidth={2}
              strokeDasharray="4 3"
            />
          </Svg>
        ))}
      </View>
    );
  }

  const shown = [...foods].reverse();
  // 맨 오른쪽(가장 최근) 원을 뺀 폭에만 흐림을 덮는다. 가장 최근 음식은 늘 또렷하다
  const fadeWidth = (shown.length - 1) * (PLATE - OVERLAP);
  return (
    <View
      className="flex-row"
      style={{ marginVertical: -BLEED }}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {shown.map((food, i) => (
        <View
          key={food.food_id}
          className="rounded-full border-2 border-surface"
          style={[{ borderColor: back }, i > 0 ? { marginLeft: -OVERLAP } : null]}>
          <FoodThumb foodId={food.food_id} imageUrl={food.image_url} size="xxs" />
        </View>
      ))}
      {fadeWidth > 0 ? (
        <View style={{ position: 'absolute', left: 0, top: 0, width: fadeWidth, height: PLATE }}>
          <Svg width={fadeWidth} height={PLATE}>
            <Defs>
              <LinearGradient id="plate-fade" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={back} stopOpacity={0.85} />
                <Stop offset="1" stopColor={back} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width={fadeWidth} height={PLATE} fill="url(#plate-fade)" />
          </Svg>
        </View>
      ) : null}
    </View>
  );
}
