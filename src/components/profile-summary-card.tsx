import type { ReactNode } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import colors from '@/constants/colors.json';

// 내 프로필 상단 카드 (4-15, docs/design.md 순간 3). 주황 그라데이션 바탕에 네 글자 타일과 아이디·레벨.
// 공유 버튼은 L(#43)이 붙인다. 이 카드에는 못 먹는 것을 절대 넣지 않는다(공유 이미지 규칙)
export function ProfileSummaryCard({
  letters,
  name,
  handle,
  title,
  level,
  toNext,
  action,
}: {
  letters: string[] | null;
  name: string;
  handle: string | null;
  title: string | null;
  level: number;
  toNext: number;
  // 네 글자가 없을 때 "내 네 글자 만들기" 같은 버튼 자리
  action?: ReactNode;
}) {
  return (
    <View
      className="relative gap-5 overflow-hidden rounded-3xl bg-primary p-6 shadow-sm"
      style={
        Platform.OS === 'web'
          ? ({
              backgroundImage: `linear-gradient(135deg, ${colors['food-7']} 0%, ${colors.primary} 55%, ${colors['food-5']} 100%)`,
            } as any)
          : undefined
      }>
      {/* 네이티브(iOS/Android)에서는 SVG LinearGradient 사용 (웹에서는 브라우저 라우팅 시 SVG fill url 해시 깨짐 방지를 위해 CSS 그라데이션) */}
      {Platform.OS !== 'web' ? (
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            <LinearGradient id="profileCardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={colors['food-7']} stopOpacity="1" />
              <Stop offset="55%" stopColor={colors.primary} stopOpacity="1" />
              <Stop offset="100%" stopColor={colors['food-5']} stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#profileCardGrad)" rx={24} />
        </Svg>
      ) : null}

      {letters ? (
        <View accessibilityLabel={`내 네 글자 ${letters.join('')}`} className="w-40 flex-row flex-wrap gap-2">
          {letters.map((l, i) => (
            <View key={i} className="h-[76px] w-[76px] items-center justify-center rounded-2xl bg-on-primary shadow-sm">
              <Text className="text-5xl font-extrabold text-primary">{l}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View className="gap-1">
        <Text className="text-2xl font-extrabold tracking-tight text-on-primary" numberOfLines={1}>
          {handle ? `@${handle}` : name}
        </Text>
        {title ? <Text className="text-xl font-bold text-on-primary">{title}</Text> : null}
        <Text className="text-xl font-bold text-on-primary">
          레벨 {level}, 다음 레벨까지 {toNext}끼
        </Text>
      </View>

      {action}
    </View>
  );
}
