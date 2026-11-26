import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { FoodThumb } from '@/components/food-thumb';
import { foodTint, TINT_BG, tintValue } from '@/constants/food-tint';
import { Text } from '@/components/text';
import { dayLabel, groupByMonth, monthStatLine, type TimelineMeal } from '@/constants/dex';
import { useGroupTimeline } from '@/hooks/use-dex';

// 4-25 모임 식사 타임라인. 월별로 묶고 처음에는 5끼만, "더 보기"로 전체(최대 60끼)
const FIRST = 5;

export function MealTimeline({ groupId }: { groupId: string }) {
  const router = useRouter();
  const { meals, isError } = useGroupTimeline(groupId);
  const [all, setAll] = useState(false);

  if (isError) return null;
  if (!meals) return <View className="h-20 rounded-3xl bg-surface" />;
  if (meals.length === 0) {
    return (
      <View className="rounded-3xl bg-surface p-4">
        <Text className="text-lg font-semibold text-muted">아직 기록이 없어요</Text>
      </View>
    );
  }
  const stat = monthStatLine(meals);
  const shown = all ? meals : meals.slice(0, FIRST);
  // 한 끼가 한 칸. 큰 회색 상자 안에 얇은 줄을 쌓지 않는다 (docs/design.md "화면 규칙": 목록 칸 높이 72 이상)
  return (
    <View className="gap-3">
      {stat ? <Text className="text-base text-text">{stat}</Text> : null}
      {groupByMonth(shown).map((g) => (
        <View key={g.month} className="gap-2">
          <Text className="text-sm text-muted">{g.month}</Text>
          {g.meals.map((m) => (
            <MealRow key={m.mealId} meal={m} onPress={() => router.push(`/meals/${m.mealId}` as any)} />
          ))}
        </View>
      ))}
      {meals.length > FIRST ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setAll(!all)}
          className="h-12 items-center justify-center rounded-xl bg-surface active:opacity-70">
          <Text className="text-base font-bold text-text">{all ? '접기' : `더 보기 (${meals.length}끼)`}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function MealRow({ meal, onPress }: { meal: TimelineMeal; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${dayLabel(meal.eatenAt)} ${meal.foodName} 결과 카드`}
      onPress={onPress}
      className={`flex-row items-center gap-3 rounded-3xl p-4 active:opacity-70 ${TINT_BG[foodTint(meal.foodId)]}`}>
      <FoodThumb foodId={meal.foodId} size="sm" imageUrl={meal.imageUrl} />
      <View className="flex-1 gap-1">
        <Text className="text-lg font-bold text-text">
          {meal.foodName}
        </Text>
        <Text className="text-sm text-muted">{dayLabel(meal.eatenAt)}</Text>
      </View>
      {/* 겹친 동그라미 사이의 고리는 칸 바탕색이다 (선이 아니라 틈) */}
      <View className="flex-row">
        {meal.eaters.slice(0, 4).map((n, i) => (
          <View key={`${n}-${i}`} className="-ml-2 h-8 w-8 items-center justify-center rounded-full border-2 border-surface bg-surface-strong" style={{ borderColor: tintValue(foodTint(meal.foodId)) }}>
            <Text className="text-xs font-semibold text-text">{Array.from(n)[0] ?? ''}</Text>
          </View>
        ))}
        {meal.eaters.length > 4 ? <Text className="ml-1 self-center text-xs font-semibold text-muted">+{meal.eaters.length - 4}</Text> : null}
      </View>
    </Pressable>
  );
}
