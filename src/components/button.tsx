import { ActivityIndicator, Pressable, Text } from 'react-native';

import colors from '@/constants/colors.json';

type ButtonProps = {
  label: string;
  onPress: () => void;
  // primary는 화면에서 가장 중요한 버튼 하나에만 쓴다 (spec.md 7절 "요소 하나에 강조 신호 하나")
  // inverse는 주황 바탕 위의 흰 버튼이다. 주황 위에 주황 버튼을 두지 않는다 (docs/design.md 순간 1)
  variant?: 'primary' | 'secondary' | 'inverse';
  // 꺼진 버튼은 눌리지 않고 회색 덩어리로 보인다. 흐린 주황은 힘없어 보여서 쓰지 않는다. 예: 이름이 비면 버튼이 꺼진다 (4-2, 4-5)
  disabled?: boolean;
  // 서버 응답을 기다리는 동안. 두 번 눌리지 않게 꺼진 것으로 다룬다
  loading?: boolean;
  // 화면에 맞춰 폭이나 정렬만 더할 때 쓴다. 색과 높이는 위 variant로 정한다. 예: 빈 홈의 "첫 모임 만들기"는 글 길이에 맞춰 가운데 (PR #52)
  className?: string;
};

// 화면 공통 버튼 (이슈 #10)
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  className = '',
}: ButtonProps) {
  const off = disabled || loading;
  const primary = variant === 'primary';
  // 기다리는 중(loading)은 원래 색을 두고, 꺼진 것(disabled)만 회색
  const grey = disabled && !loading;
  const bg = grey
    ? 'bg-surface-strong'
    : primary
      ? 'bg-primary'
      : variant === 'inverse'
        ? 'bg-on-primary'
        : 'bg-surface';
  const fg = grey ? 'text-muted' : primary ? 'text-on-primary' : 'text-text';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off, busy: loading }}
      disabled={off}
      onPress={onPress}
      className={`h-14 items-center justify-center rounded-full px-6 active:opacity-80 ${bg} ${className}`}>
      {loading ? (
        // 로딩 표시는 className을 받지 못해서 토큰 값을 colors.json에서 꺼내 준다
        <ActivityIndicator color={primary ? colors['on-primary'] : colors.text} />
      ) : (
        <Text className={`text-lg font-bold ${fg}`}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}
