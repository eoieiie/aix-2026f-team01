import { useEffect, useState } from 'react';
import { Animated, Easing, Image, Platform, Text, View } from 'react-native';

import { PersonDots } from '@/components/person-dots';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { mealDateLabel, monthCuisineLine, togetherLines, type MealCard } from '@/hooks/use-meal';

const iconSource = require('../../assets/images/icon.png');
const mascotSource = require('../../assets/images/mascot.png');

// 결과 카드 (4-17, docs/design.md 순간 3). 포스터처럼 4:5, 주황 바탕, 안쪽 여백 24.
// 위: 좌측 icon.png + 우측 날짜, 가운데: 음식과 "우리 모임 N번째",
// 아래: 좌측 2줄(모임 이름, 나의 N번째) + 우측 하단: 큰 마스코트
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
        className="aspect-[4/5] w-full justify-between overflow-hidden rounded-3xl bg-primary p-6 shadow-sm">
        {/* 음식 동그라미를 크게 키운 은은한 배경 무늬 */}
        <View className="absolute -bottom-20 -right-20 h-56 w-56 rounded-full bg-on-primary opacity-10" />

        {/* 상단: 좌측 앱 아이콘 + 우측 날짜 */}
        <View className="flex-row items-center justify-between gap-3">
          <Image
            source={iconSource}
            style={{ width: 36, height: 36, borderRadius: 10 }}
            resizeMode="contain"
            accessibilityLabel="밥BTI 아이콘"
          />
          <Text className="text-base font-semibold text-on-primary opacity-90">
            {mealDateLabel(card.eatenAt)}
          </Text>
        </View>

        {/* 중앙: 음식명과 모임 통계 */}
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

        {/* 중하단: 함께 먹은 사람 */}
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

        {/* 하단: 좌측 2줄(모임 이름 + 나의 N번째) */}
        <View className="flex-row items-end justify-between">
          <View className="max-w-[58%] gap-1 pb-1">
            <Text className="text-lg font-extrabold text-on-primary" numberOfLines={1}>
              {card.groupName}
            </Text>
            {card.myFoodNth !== null ? (
              <Text className="text-sm font-bold text-on-primary opacity-90" numberOfLines={1}>
                나의 {card.myFoodNth}번째 {card.foodName}
              </Text>
            ) : null}
          </View>
        </View>

        {/* 우측 하단: 크게 배치된 마스코트 */}
        <View pointerEvents="none" className="absolute -bottom-2 -right-2 items-end justify-end">
          <Image
            source={mascotSource}
            style={{ width: 155, height: 122 }}
            resizeMode="contain"
            accessibilityLabel="밥BTI 마스코트"
          />
        </View>
      </View>
    </Animated.View>
  );
}
