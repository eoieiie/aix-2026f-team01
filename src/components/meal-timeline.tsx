import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';

import { FoodDot } from '@/components/food-dot';
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
  if (!meals) return <View className="h-24 rounded-3xl bg-surface" />;
  if (meals.length === 0) {
    return (
      <View className="rounded-3xl bg-surface p-6">
        <Text className="text-lg font-bold text-muted">아직 기록이 없어요</Text>
      </View>
    );
  }
  const stat = monthStatLine(meals);
  const shown = all ? meals : meals.slice(0, FIRST);
  return (
    <View className="gap-3">
      {stat ? <Text className="text-base font-bold text-text">{stat}</Text> : null}
      <View className="gap-4 rounded-3xl bg-surface p-5">
        {groupByMonth(shown).map((g) => (
          <View key={g.month} className="gap-3">
            <Text className="text-sm font-bold text-muted">{g.month}</Text>
            {g.meals.map((m) => (
              <MealRow key={m.mealId} meal={m} onPress={() => router.push(`/meals/${m.mealId}` as any)} />
            ))}
          </View>
        ))}
        {meals.length > FIRST ? (
          <Pressable accessibilityRole="button" onPress={() => setAll(!all)} className="min-h-11 items-center justify-center rounded-2xl bg-background">
            <Text className="text-base font-bold text-text">{all ? '접기' : `더 보기 (${meals.length}끼)`}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function MealRow({ meal, onPress }: { meal: TimelineMeal; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${dayLabel(meal.eatenAt)} ${meal.foodName} 결과 카드`}
      onPress={onPress}
      className="min-h-11 flex-row items-center gap-3 active:opacity-70">
      {meal.imageUrl ? (
        <View className="h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-background">
          <Image source={{ uri: meal.imageUrl }} style={{ width: 40, height: 40 }} resizeMode="cover" />
        </View>
      ) : (
        <FoodDot foodId={meal.foodId} size="md" name={meal.foodName} />
      )}
      <View className="flex-1 gap-0.5">
        <Text className="text-lg font-bold text-text" numberOfLines={1}>
          {meal.foodName}
        </Text>
        <Text className="text-sm text-muted">{dayLabel(meal.eatenAt)}</Text>
      </View>
      <View className="flex-row">
        {meal.eaters.slice(0, 4).map((n, i) => (
          <View key={`${n}-${i}`} className="-ml-2 h-8 w-8 items-center justify-center rounded-full border-2 border-surface bg-surface-strong">
            <Text className="text-xs font-bold text-text">{Array.from(n)[0] ?? ''}</Text>
          </View>
        ))}
        {meal.eaters.length > 4 ? <Text className="ml-1 self-center text-xs font-bold text-muted">+{meal.eaters.length - 4}</Text> : null}
      </View>
    </Pressable>
  );
}
