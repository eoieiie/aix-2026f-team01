import { ActivityIndicator, Pressable, Text } from 'react-native';

type ButtonProps = {
  label: string;
  onPress: () => void;
  // primary는 화면에서 가장 중요한 버튼 하나에만 쓴다 (spec.md 7절 "요소 하나에 강조 신호 하나")
  variant?: 'primary' | 'secondary';
  // 꺼진 버튼은 눌리지 않고 흐리게 보인다. 예: 이름이 비면 버튼이 꺼진다 (4-2, 4-5)
  disabled?: boolean;
  // 서버 응답을 기다리는 동안. 두 번 눌리지 않게 꺼진 것으로 다룬다
  loading?: boolean;
};

// 화면 공통 버튼 (이슈 #10)
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
}: ButtonProps) {
  const off = disabled || loading;
  const primary = variant === 'primary';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off, busy: loading }}
      disabled={off}
      onPress={onPress}
      className={`h-12 items-center justify-center rounded-xl px-6 active:opacity-80 disabled:opacity-50 ${
        primary ? 'bg-primary' : 'bg-surface'
      }`}>
      {loading ? (
        // 색은 text- 토큰으로 준다. NativeWind가 text 색을 ActivityIndicator의 color로 넘긴다
        <ActivityIndicator className={primary ? 'text-on-primary' : 'text-text'} />
      ) : (
        <Text className={`text-base font-semibold ${primary ? 'text-on-primary' : 'text-text'}`}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}
