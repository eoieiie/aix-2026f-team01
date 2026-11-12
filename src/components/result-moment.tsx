import { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Roulette } from '@/components/roulette';
import colors from '@/constants/colors.json';
import { RESULT_MOMENT_FLOOD_MS, RESULT_MOMENT_PAUSE_MS, RESULT_MOMENT_TEXT_MS } from '@/constants';
import { rouletteSlices, type SessionView, useVoteCounts } from '@/hooks/use-session';
import { useSessionMealId } from '@/hooks/use-meal';
import { useReduceMotion } from '@/hooks/use-reduce-motion';

export type Point = { x: number; y: number };

// 음식 이름이 길면 한 단계씩 작게. 화면 폭(약 320) 안에 한 줄로 들어가게 한다
function nameSizeClass(name: string) {
  const n = Array.from(name).length;
  if (n <= 3) return 'text-7xl';
  if (n <= 5) return 'text-6xl';
  return 'text-5xl';
}

// 4표 중 1표로 뽑혔는지. 아무도 안 찍었으면 모든 후보가 같은 크기로 돌았다 (4-12)
export function voteLine(counts: { foodId: number; voteCount: number }[], winnerId: number) {
  const total = counts.reduce((sum, c) => sum + c.voteCount, 0);
  if (total === 0) return '아무도 안 찍어서 모두 같은 크기로 돌렸어요';
  const mine = counts.find((c) => c.foodId === winnerId)?.voteCount ?? 0;
  return `${total}표 중 ${mine}표로 뽑혔어요`;
}

type ResultMomentProps = {
  session: SessionView;
  // 원판 가운데(화면 좌표). 여기서 주황이 번진다. null이면 움직임 없이 바로 보인다 (이미 끝난 판)
  from: Point | null;
  onGroup: () => void;
  // 결과 카드(4-17)로 간다. 식사 기록 id를 아직 못 읽었으면 버튼이 기다림으로 보인다
  onCard: (mealId: string) => void;
};

// 룰렛이 멈춘 순간 (docs/design.md 순간 1). 화면 전체가 주황이 되고 음식 이름이 크게 나온다
export function ResultMoment({ session, from, onGroup, onCard }: ResultMomentProps) {
  const mealId = useSessionMealId(session.id, session.status === 'done');
  // 덮는 원의 크기는 창이 아니라 이 화면 크기로 잰다. 노트북에서는 화면이 가운데 폭 480 안에 있다
  const windowSize = useWindowDimensions();
  const [box, setBox] = useState({ width: windowSize.width, height: windowSize.height });
  const { width, height } = box;
  const reduceMotion = useReduceMotion();
  const { counts } = useVoteCounts(session.id, true);
  const animateIn = from !== null;
  const [flood] = useState(() => new Animated.Value(animateIn ? 0 : 1));
  const [text] = useState(() => new Animated.Value(animateIn ? 0 : 1));

  useEffect(() => {
    if (!animateIn) return;
    const native = Platform.OS !== 'web';
    const anim = Animated.sequence([
      Animated.delay(RESULT_MOMENT_PAUSE_MS),
      Animated.timing(flood, {
        toValue: 1,
        duration: RESULT_MOMENT_FLOOD_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: native,
      }),
      Animated.timing(text, {
        toValue: 1,
        duration: RESULT_MOMENT_TEXT_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: native,
      }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [animateIn, flood, text]);

  // 동작 줄이기를 켰으면 바로 마지막 모습
  useEffect(() => {
    if (!reduceMotion) return;
    flood.setValue(1);
    text.setValue(1);
  }, [reduceMotion, flood, text]);

  // 원판 가운데에서 가장 먼 화면 모서리까지 덮는 원
  const origin = from ?? { x: width / 2, y: height / 2 };
  const radius = Math.ceil(
    Math.max(
      Math.hypot(origin.x, origin.y),
      Math.hypot(width - origin.x, origin.y),
      Math.hypot(origin.x, height - origin.y),
      Math.hypot(width - origin.x, height - origin.y)
    )
  );

  const names = new Map(session.candidates.map((c) => [c.foodId, c.foodName]));
  const winnerId = session.decidedFoodId ?? -1;
  const winner = names.get(winnerId) ?? '';
  const slices = counts
    ? rouletteSlices(counts).map((s) => ({
        ...s,
        name: names.get(s.foodId) ?? '',
      }))
    : [];
  const anyVotes = (counts ?? []).some((c) => c.voteCount > 0);

  return (
    <View
      className="absolute inset-0 overflow-hidden"
      onLayout={(e) =>
        setBox({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })
      }>
      {/* Animated.View는 className을 받지 않아서 style로 준다. 색은 colors.json의 토큰 값 */}
      <Animated.View
        style={{
          position: 'absolute',
          borderRadius: radius,
          backgroundColor: colors.primary,
          left: origin.x - radius,
          top: origin.y - radius,
          width: radius * 2,
          height: radius * 2,
          transform: [{ scale: flood }],
        }}
      />
      <Animated.View
        style={{
          flex: 1,
          opacity: text,
          transform: [
            {
              scale: text.interpolate({
                inputRange: [0, 1],
                outputRange: [0.9, 1],
              }),
            },
          ],
        }}>
        <SafeAreaView className="flex-1">
          <ScrollView contentContainerClassName="px-7 pb-6 pt-6">
            <Text className="text-base font-bold text-on-primary opacity-75" numberOfLines={1}>
              {session.groupName}
            </Text>
            <Text className="mt-10 text-lg font-extrabold text-on-primary">룰렛이 골랐어요</Text>
            <Text
              className={`mt-1 font-extrabold tracking-tight text-on-primary ${nameSizeClass(winner)}`}
              numberOfLines={1}
              adjustsFontSizeToFit>
              {winner}
            </Text>
            {counts ? (
              <Text className="mt-2 text-base font-semibold text-on-primary opacity-90">
                {voteLine(counts, winnerId)}
              </Text>
            ) : null}
            {slices.length > 0 ? (
              <View className="mt-10 items-center">
                <Roulette
                  slices={slices}
                  resultFoodId={winnerId}
                  spin={false}
                  tone="onPrimary"
                  showVotes={anyVotes}
                  maxSize={340}
                />
              </View>
            ) : null}
          </ScrollView>
          {/* 같은 역할의 버튼 둘은 같은 크기로 나란히. 결과 카드가 다음 할 일이라 흰 버튼, 모임으로는 회색 */}
          <View className="flex-row gap-2 px-7 pb-4">
            <View className="flex-1">
              <Button label="모임으로" variant="secondary" onPress={onGroup} />
            </View>
            <View className="flex-1">
              <Button
                label="결과 카드"
                variant="inverse"
                loading={!mealId}
                onPress={() => mealId && onCard(mealId)}
              />
            </View>
          </View>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}
