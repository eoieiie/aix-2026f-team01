import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, Text, View } from 'react-native';

import { PersonDots } from '@/components/person-dots';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { mealDateLabel, monthCuisineLine, togetherLines, type MealCard } from '@/hooks/use-meal';

// 결과 카드 (4-17, docs/design.md 순간 3). 포스터처럼 4:5, 주황 바탕, 안쪽 여백 24.
// 위: 모임 이름과 날짜, 가운데: 음식과 "우리 모임 N번째", 사람 동그라미와 "OO랑 N번째 밥", 아래: 밥비티아이와 나의 N번째.
// 못 먹는 것은 데이터에도 없고 그리지도 않는다
export function ResultCard({ card }: { card: MealCard }) {
  const reduceMotion = useReduceMotion();
  // 처음 보일 때만 0.96배에서 1배로 (0.25초). 동작 줄이기를 켰으면 바로 1배
  const [scale] = useState(() => new Animated.Value(0.96));
  useEffect(() => {
    if (reduceMotion) {
      scale.setValue(1);
      return;
    }
    const anim = Animated.timing(scale, {
      toValue: 1,
      duration: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    });
    anim.start();
    return () => anim.stop();
  }, [reduceMotion, scale]);

  const lines = togetherLines(card);
  const month = monthCuisineLine(card.monthCuisine);
  const n = Array.from(card.foodName).length;
  const nameSize = n <= 4 ? 'text-6xl' : n <= 6 ? 'text-5xl' : 'text-4xl';

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <View
        accessibilityLabel={`${card.groupName} ${mealDateLabel(card.eatenAt)} ${card.foodName}`}
        className="aspect-[4/5] w-full justify-between overflow-hidden rounded-3xl bg-primary p-6">
        {/* 음식 동그라미를 크게 키운 무늬. 옅은 흰 동그라미 두 개 */}
        <View className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-on-primary opacity-15" />
        <View className="absolute -bottom-6 -right-6 h-28 w-28 rounded-full bg-on-primary opacity-15" />

        <View className="flex-row items-center justify-between gap-3">
          <Text className="flex-1 text-base font-extrabold text-on-primary" numberOfLines={1}>
            {card.groupName}
          </Text>
          <Text className="text-base font-semibold text-on-primary opacity-85">{mealDateLabel(card.eatenAt)}</Text>
        </View>

        <View className="gap-2">
          <Text
            className={`font-extrabold tracking-tight text-on-primary ${nameSize}`}
            numberOfLines={1}
            adjustsFontSizeToFit>
            {card.foodName}
          </Text>
          <Text className="text-base font-bold text-on-primary">
            우리 모임 {card.groupFoodNth}번째 {card.foodName}
          </Text>
          {month ? <Text className="text-sm font-semibold text-on-primary opacity-85">{month}</Text> : null}
        </View>

        <View className="gap-2">
          {card.people.length > 0 ? (
            <PersonDots names={card.people.map((p) => p.displayName)} ringClass="border-primary" />
          ) : null}
          {lines.map((line) => (
            <Text key={line} className="text-sm font-semibold text-on-primary" numberOfLines={1}>
              {line}
            </Text>
          ))}
        </View>

        <View className="flex-row items-end justify-between">
          <Text className="text-base font-extrabold text-on-primary">밥비티아이</Text>
          {card.myFoodNth !== null ? (
            <Text className="text-sm font-bold text-on-primary">
              나의 {card.myFoodNth}번째 {card.foodName}
            </Text>
          ) : null}
        </View>
      </View>
    </Animated.View>
  );
}
