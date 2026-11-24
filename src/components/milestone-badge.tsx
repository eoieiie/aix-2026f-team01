import { View } from 'react-native';

import { Text } from '@/components/text';
import { milestoneLabel } from '@/constants/dex';
import { useFoodDex } from '@/hooks/use-dex';

// 4-25 결과 순간의 기념 딱지. 내 도감에서 이 메뉴를 먹은 횟수(이번 판 포함)가 1이면 "새 메뉴 모음!", 10/20/30/50/100이면 "N번째 OO".
// 내가 이 판의 식사에 들어 있지 않으면(관전) 0이라 아무것도 없다
export function MilestoneBadge({ foodId, foodName }: { foodId: number; foodName: string }) {
  const { dex } = useFoodDex(foodId > 0);
  const count = dex?.find((f) => f.foodId === foodId)?.mealCount ?? 0;
  const label = count > 0 ? milestoneLabel(foodName, count) : null;
  if (!label) return null;
  return (
    <View className="mt-6 self-start rounded-full bg-on-primary px-4 py-2" accessibilityLabel={label}>
      <Text className="text-base font-bold text-text">{label}</Text>
    </View>
  );
}
