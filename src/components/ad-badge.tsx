import { View } from 'react-native';

import { Text } from '@/components/text';

// 제휴 가게 이름 바로 옆에 붙는 "광고" (공정위 추천·보증 심사지침: 경제적 이해관계는 추천 가까이).
// 테두리 대신 회색 면으로 그린다 (docs/design.md 상자는 면으로)
export function AdBadge() {
  return (
    <View accessibilityLabel="광고" className="rounded-lg bg-surface-strong px-2">
      <Text className="text-xs font-bold text-muted">광고</Text>
    </View>
  );
}
