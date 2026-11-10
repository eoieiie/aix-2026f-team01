import { Text, View } from 'react-native';

// 앱 로고. 주황 네모 안의 흰 "밥"과 검정 "BTI" (docs/design.md 4절).
// 글자로 그려서 어느 크기에서도 선명하고, 색은 토큰만 쓴다. 주황 네모는 앱 아이콘에도 같은 모양으로 쓴다
export function Logo() {
  return (
    <View accessibilityRole="header" accessibilityLabel="밥BTI" className="flex-row items-center gap-2">
      <View className="h-11 w-11 items-center justify-center rounded-xl bg-primary">
        <Text className="text-2xl font-extrabold text-on-primary">밥</Text>
      </View>
      <Text className="text-3xl font-extrabold tracking-tight text-text">BTI</Text>
    </View>
  );
}
