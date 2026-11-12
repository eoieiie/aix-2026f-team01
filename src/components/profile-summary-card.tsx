import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

// 내 프로필 상단 카드 (4-15, docs/design.md 순간 3). 검정 바탕에 네 글자 칸을 작게, 아래에 아이디와 레벨.
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
    <View className="gap-5 rounded-3xl bg-ink p-6">
      {letters ? (
        <View accessibilityLabel={`내 네 글자 ${letters.join('')}`} className="w-40 flex-row flex-wrap gap-2">
          {letters.map((l, i) => (
            <View key={i} className="h-[76px] w-[76px] items-center justify-center rounded-2xl bg-food-8">
              <Text className="text-5xl font-extrabold text-on-ink">{l}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <View className="gap-1">
        <Text className="text-2xl font-extrabold tracking-tight text-on-ink" numberOfLines={1}>
          {handle ? `@${handle}` : name}
        </Text>
        {title ? <Text className="text-base font-bold text-on-ink opacity-80">{title}</Text> : null}
        <Text className="text-base text-on-ink opacity-60">
          레벨 {level}, 다음 레벨까지 {toNext}끼
        </Text>
      </View>
      {action}
    </View>
  );
}
