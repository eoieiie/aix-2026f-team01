import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

type CardProps = {
  children: ReactNode;
  // 있으면 누를 수 있는 카드가 된다. 예: 초대 카드를 누르면 링크 복사 (4-4)
  onPress?: () => void;
  accessibilityLabel?: string;
};

const CARD = 'gap-2 rounded-2xl bg-surface p-4';

// 화면 공통 카드 (이슈 #10). 테두리 대신 배경색으로 구분한다 (spec.md 7절)
export function Card({ children, onPress, accessibilityLabel }: CardProps) {
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        className={`${CARD} active:opacity-80`}>
        {children}
      </Pressable>
    );
  }

  return (
    <View accessibilityLabel={accessibilityLabel} className={CARD}>
      {children}
    </View>
  );
}
