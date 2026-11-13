import { useEffect, useState } from 'react';
import { Animated, Easing, Image, Platform, Text, View } from 'react-native';

import { PersonDots } from '@/components/person-dots';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { mealDateLabel, monthCuisineLine, togetherLines, type MealCard } from '@/hooks/use-meal';

const logoWhiteSource = require('../../assets/images/logo-white.png');
const mascotSource = require('../../assets/images/mascot.png');

// 결과 카드 (4-17, docs/design.md 순간 3). 포스터처럼 4:5, 주황 바탕, 안쪽 여백 24.
// 상단: 좌측 흰색 밥 심볼 로고 + 우측 날짜
// 가운데: 음식과 "우리 모임 N번째", 함께 먹은 사람
// 하단: 좌측 2줄(모임 이름, 나의 N번째) + 우측 하단 밥BTI 마스코트
export function ResultCard({ card }: { card: MealCard }) {
  const reduceMotion = useReduceMotion();
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
        className="relative aspect-[4/5] w-full justify-between overflow-hidden rounded-3xl bg-primary p-6 shadow-sm">
        {/* 우측 하단 동심원 배경 무늬 */}
        <View className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-on-primary opacity-10" />
        <View className="pointer-events-none absolute -bottom-10 -right-10 h-44 w-44 rounded-full bg-on-primary opacity-10" />

        {/* 상단: 좌측 흰색 밥 로고 심볼 + 우측 날짜 */}
        <View className="flex-row items-center justify-between">
          <Image
            source={logoWhiteSource}
            style={{ width: 48, height: 57 }}
            resizeMode="contain"
            accessibilityLabel="밥BTI 로고"
          />
          <Text className="text-xl font-bold text-on-primary">
            {mealDateLabel(card.eatenAt)}
          </Text>
        </View>

        {/* 중앙: 음식명과 모임 통계 */}
        <View className="gap-2 z-10">
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
        <View className="gap-2 z-10">
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
        <View className="z-10 max-w-[58%] gap-1 pt-2">
          <Text className="text-xl font-extrabold text-on-primary" numberOfLines={1}>
            {card.groupName}
          </Text>
          {card.myFoodNth !== null ? (
            <Text className="text-sm font-bold text-on-primary opacity-90" numberOfLines={1}>
              나의 {card.myFoodNth}번째 {card.foodName}
            </Text>
          ) : null}
        </View>

        {/* 우측 하단: 레퍼런스 위치의 밥BTI 마스코트 */}
        <Image
          source={mascotSource}
          style={{ width: 154, height: 118, position: 'absolute', bottom: 14, right: 12 }}
          resizeMode="contain"
          accessibilityLabel="밥BTI 마스코트"
        />
      </View>
    </Animated.View>
  );
}
