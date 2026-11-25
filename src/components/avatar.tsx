import { View } from 'react-native';

import { FoodIllustration } from '@/components/food-illustration';
import { Text } from '@/components/text';
import { useAvatars } from '@/hooks/use-prefs';

// 사람 동그라미 (명세 4-27). 아바타(기본 메뉴 그림)를 고른 사람은 그 그림, 아니면 이름 첫 글자.
// 크기는 목록 30, 카드 44 (프레즐 간격 규칙의 아바타 크기). 회색 면에 검정 글자라 주황을 쓰지 않는다
export type AvatarSize = 30 | 44 | 72;

const LETTER: Record<AvatarSize, string> = { 30: 'text-xs', 44: 'text-base', 72: 'text-2xl' };

export function Avatar({
  name,
  userId,
  foodId,
  size = 30,
}: {
  name: string;
  // 있으면 그 사람이 고른 아바타를 찾아 그린다
  userId?: string | null;
  // 고르는 중인 그림처럼 음식 id를 바로 줄 때
  foodId?: number | null;
  size?: AvatarSize;
}) {
  const avatars = useAvatars();
  const id = foodId ?? (userId ? avatars[userId] : undefined) ?? null;
  return (
    <View
      accessibilityLabel={name}
      className="items-center justify-center overflow-hidden rounded-full bg-surface-strong"
      style={{ width: size, height: size }}>
      <Text className={`${LETTER[size]} font-bold text-text`}>{Array.from(name)[0] ?? ''}</Text>
      {id ? (
        // 그림을 못 받으면 FoodIllustration이 아무것도 그리지 않아 아래 첫 글자가 그대로 보인다
        <View className="absolute inset-0">
          <FoodIllustration foodId={id} size={size} name={name} />
        </View>
      ) : null}
    </View>
  );
}
