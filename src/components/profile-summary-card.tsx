import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Text } from '@/components/text';

// 내 프로필 상단 카드 (4-15, 4-27). 회색 면 위에 아바타와 이름, 네 글자, 레벨 막대, 다음에 열리는 아바타.
// 이 화면의 주황은 레벨 막대 채움 하나다. 이 카드에는 못 먹는 것, 단과대, 취향을 넣지 않는다(공유 이미지 규칙)
export function ProfileSummaryCard({
  letters,
  name,
  handle,
  title,
  level,
  toNext,
  progress,
  avatarFoodId,
  nextAvatar,
  onEdit,
  action,
}: {
  letters: string[] | null;
  name: string;
  handle: string | null;
  title: string | null;
  level: number;
  toNext: number;
  // 이번 레벨에서 채운 비율 (0~1)
  progress: number;
  avatarFoodId?: number | null;
  // 다음에 열리는 아바타. 서버 규칙(레벨이 오르면 하나씩)에서 온 값만 보인다. 지어낸 혜택은 쓰지 않는다
  nextAvatar?: { foodId: number; name: string; unlockLevel: number } | null;
  onEdit: () => void;
  // 네 글자가 없을 때 "내 네 글자 만들기" 자리
  action?: ReactNode;
}) {
  const percent = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  return (
    <View className="gap-4 rounded-2xl bg-surface p-4">
      <View className="flex-row items-center gap-3">
        <Avatar name={name} foodId={avatarFoodId} size={44} />
        <View className="flex-1 gap-1">
          <Text className="text-xl font-bold tracking-tight text-text" numberOfLines={1}>
            {name}
          </Text>
          {handle || title ? (
            <Text className="text-sm text-muted" numberOfLines={1}>
              {handle ? `@${handle}` : title}
            </Text>
          ) : null}
        </View>
        {handle && title ? (
          <View className="h-8 justify-center rounded-lg bg-background px-2">
            <Text className="text-xs font-bold text-text">{title}</Text>
          </View>
        ) : null}
      </View>

      {letters ? (
        // 네 칸을 한 줄에 같은 폭으로 둔다 (같은 역할은 같은 크기)
        <View accessibilityLabel={`내 네 글자 ${letters.join('')}`} className="flex-row gap-2">
          {letters.map((l, i) => (
            <View key={i} className="h-14 flex-1 items-center justify-center rounded-lg bg-background">
              <Text className="text-3xl font-extrabold text-text">{l}</Text>
            </View>
          ))}
        </View>
      ) : (
        action
      )}

      <View className="gap-2">
        <View className="flex-row items-baseline justify-between">
          <Text className="text-base font-bold text-text">레벨 {level}</Text>
          <Text className="text-sm text-muted">다음 레벨까지 {toNext}끼</Text>
        </View>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel={`레벨 ${level}, 다음 레벨까지 ${toNext}끼`}
          accessibilityValue={{ min: 0, max: 100, now: percent }}
          className="h-2 overflow-hidden rounded-full bg-surface-strong">
          <View className="h-2 rounded-full bg-primary" style={{ width: `${percent}%` }} />
        </View>
      </View>

      {nextAvatar ? (
        <View className="flex-row items-center gap-3 rounded-lg bg-background p-3">
          <View style={{ opacity: 0.4 }}>
            <Avatar name={nextAvatar.name} foodId={nextAvatar.foodId} size={44} />
          </View>
          <View className="flex-1 gap-1">
            <Text className="text-sm font-bold text-text">레벨 {nextAvatar.unlockLevel}에 열려요</Text>
            <Text className="text-sm text-muted" numberOfLines={1}>
              {nextAvatar.name} 아바타
            </Text>
          </View>
        </View>
      ) : null}

      <CardButton label="프로필 고치기" onPress={onEdit} />
    </View>
  );
}

// 카드 안 단추: 흰 면, 높이 44, 모서리 8 (카드 16 - 여백 8)
export function CardButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="h-11 items-center justify-center rounded-lg bg-background active:opacity-70">
      <Text className="text-base font-bold text-text">{label}</Text>
    </Pressable>
  );
}
