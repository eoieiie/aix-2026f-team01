import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/text';

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
      className="relative gap-5 overflow-hidden rounded-3xl bg-primary p-6">
      {/* 그라데이션은 뺐다. 주황 한 면으로 둔다 (2026-11-19, 웹과 앱이 같게, 흰 글자 대비) */}

      {letters ? (
        // 2x2를 줄 두 개로 나눠 그린다. flex-wrap과 고정 폭(160)은 아이폰에서 글자 칸이 한 줄에 하나씩 떨어졌다(11/20 실기기)
        <View accessibilityLabel={`내 네 글자 ${letters.join('')}`} className="gap-2">
          {[letters.slice(0, 2), letters.slice(2, 4)].map((row, r) => (
            <View key={r} className="flex-row gap-2">
              {row.map((l, i) => (
                <View key={i} className="h-[76px] w-[76px] items-center justify-center rounded-2xl bg-on-primary">
                  <Text className="text-5xl font-extrabold text-primary">{l}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      ) : null}

      <View className="gap-1">
        <Text className="text-2xl font-bold tracking-tight text-on-primary" numberOfLines={1}>
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
