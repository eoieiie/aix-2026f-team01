import type { ReactNode } from 'react';
import { Image, View } from 'react-native';

import { FoodThumb } from '@/components/food-thumb';
import { Text } from '@/components/text';

const mascotSource = require('../../assets/images/mascot.png');

// 시안 다 "머리에 그림" (2026-11-26). 화면 맨 위 옅은 주황 면의 머리 칸 하나.
// 왼쪽에 인사 한 줄(있으면)과 화면 제목, 그 아래 화면의 작은 단추(있으면), 오른쪽에 음식 그림이나 마스코트.
// 주황 면은 이 칸 하나뿐이고 카드와 바탕은 그대로 둔다. 인사 글자는 옅은 주황 위 진한 주황(대비 4.55)
export function HeroBand({
  title,
  greeting,
  foodId,
  children,
}: {
  title: string;
  greeting?: string;
  // 있으면 그 음식 그림, 없으면 마스코트
  foodId?: number | null;
  children?: ReactNode;
}) {
  return (
    <View className="flex-row items-center gap-4 rounded-3xl bg-primary-soft p-4">
      <View className="flex-1 gap-3">
        <View className="gap-1">
          {greeting ? <Text className="text-sm font-semibold text-on-primary-soft">{greeting}</Text> : null}
          <Text accessibilityRole="header" className="text-3xl font-bold tracking-tight text-text">
            {title}
          </Text>
        </View>
        {children}
      </View>
      {foodId != null ? (
        <FoodThumb foodId={foodId} size="xl" />
      ) : (
        <View className="h-[88px] w-[88px] items-center justify-center rounded-full bg-background">
          <Image source={mascotSource} style={{ width: 56, height: 43 }} resizeMode="contain" accessibilityLabel="밥BTI 마스코트" />
        </View>
      )}
    </View>
  );
}

// 지금 시각에 맞춘 인사 한 줄
export function mealGreeting(now = new Date()) {
  const h = now.getHours();
  if (h < 10) return '아침 시간이에요';
  if (h < 15) return '점심 시간이에요';
  if (h < 21) return '저녁 시간이에요';
  return '야식 시간이에요';
}
