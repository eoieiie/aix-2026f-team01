import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';

import { FoodDot } from '@/components/food-dot';
import { Text } from '@/components/text';
import { dayLabel, dexProgress, type DexFood } from '@/constants/dex';
import { useFoodDex } from '@/hooks/use-dex';

// 4-25 음식 도감. 기본 메뉴 40개를 그림 카드로 모은다. 안 먹은 메뉴는 흐린 그림과 "?".
// 모음 막대는 검정이다. 프로필 탭의 주황은 레벨 막대 하나만 쓴다 (2026-11-25)
export function FoodDex() {
  const { dex, isLoading, isError, refetch } = useFoodDex();
  const [selected, setSelected] = useState<number | null>(null);

  if (isLoading) return <View className="h-40 rounded-2xl bg-surface" />;
  if (isError || !dex) {
    return (
      <Pressable accessibilityRole="button" onPress={() => refetch()} className="min-h-11 rounded-2xl bg-surface p-6">
        <Text className="text-lg font-bold text-muted">도감을 불러오지 못했어요. 눌러서 다시</Text>
      </Pressable>
    );
  }
  const { collected, total } = dexProgress(dex);
  const base = dex.filter((f) => !f.custom);
  const custom = dex.filter((f) => f.custom && f.mealCount > 0);
  const picked = dex.find((f) => f.foodId === selected) ?? null;

  return (
    <View className="gap-4">
      <View className="gap-2">
        <Text className="text-base font-bold text-text">
          {total}개 중 {collected}개 모음
        </Text>
        <View className="h-3 overflow-hidden rounded-full bg-surface-strong" accessibilityLabel={`${total}개 중 ${collected}개 모음`}>
          <View className="h-3 rounded-full bg-ink" style={{ width: `${total ? (collected / total) * 100 : 0}%` }} />
        </View>
      </View>

      {picked ? <DexDetail food={picked} onClose={() => setSelected(null)} /> : null}

      <View className="flex-row flex-wrap justify-between gap-y-2">
        {base.map((f) => (
          <DexTile key={f.foodId} food={f} on={f.foodId === selected} onPress={() => setSelected(f.foodId === selected ? null : f.foodId)} />
        ))}
      </View>

      {custom.length > 0 ? (
        <View className="gap-2">
          <Text className="text-base font-bold text-text">직접 적은 메뉴</Text>
          <View className="gap-2 rounded-2xl bg-surface p-4">
            {custom.map((f) => (
              <Pressable
                key={f.foodId}
                accessibilityRole="button"
                onPress={() => setSelected(f.foodId === selected ? null : f.foodId)}
                className="min-h-11 flex-row items-center gap-3">
                <FoodDot foodId={f.foodId} size="sm" />
                <Text className="flex-1 text-base font-bold text-text">{f.name}</Text>
                <Text className="text-sm font-semibold text-muted">{f.mealCount}번</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function DexTile({ food, on, onPress }: { food: DexFood; on: boolean; onPress: () => void }) {
  const eaten = food.mealCount > 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={eaten ? `${food.name} ${food.mealCount}번` : '아직 안 먹은 메뉴'}
      onPress={eaten ? onPress : undefined}
      disabled={!eaten}
      className={`w-[23.5%] items-center gap-1 rounded-2xl p-2 ${on ? 'bg-surface-strong' : 'bg-surface'}`}>
      {/* 결과 화면 그림(FoodIllustration)과 같은 모양: 흰 원 안에 둥글게 자른 그림. 그림 배경(옅은 미색 네모)이 회색 칸 위에 드러나지 않는다 */}
      <View className="aspect-square w-full items-center justify-center overflow-hidden rounded-full bg-on-primary">
        {food.imageUrl ? (
          <Image
            source={{ uri: food.imageUrl }}
            style={{ width: '92%', height: '92%', borderRadius: 999, opacity: eaten ? 1 : 0.18 }}
            resizeMode="cover"
          />
        ) : null}
        {!eaten ? <Text className="absolute text-2xl font-bold text-muted">?</Text> : null}
      </View>
      <Text className={`text-xs font-bold ${eaten ? 'text-text' : 'text-muted'}`} numberOfLines={1}>
        {eaten ? food.name : '???'}
      </Text>
      {eaten ? <Text className="text-xs font-semibold text-muted">{food.mealCount}번</Text> : null}
    </Pressable>
  );
}

function DexDetail({ food, onClose }: { food: DexFood; onClose: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${food.name} 기록 닫기`} onPress={onClose} className="gap-1 rounded-2xl bg-surface p-4">
      <Text className="text-lg font-bold text-text">{food.name}</Text>
      {food.firstEaten ? <Text className="text-sm text-text">처음 먹은 날 {dayLabel(food.firstEaten)}</Text> : null}
      {food.lastEaten ? <Text className="text-sm text-text">마지막으로 {dayLabel(food.lastEaten)}</Text> : null}
      <Text className="text-sm text-text">
        {food.mealCount}번 먹었고, 같이 먹은 사람 {food.companionCount}명
      </Text>
    </Pressable>
  );
}
