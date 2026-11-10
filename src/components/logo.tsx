import { Text, View } from 'react-native';

// 앱 로고. 주황 네모 안의 흰 "밥"과 검정 "BTI" (docs/design.md 4절).
// 위쪽 줄(높이 48)의 옆 버튼보다 작게 둬서 아래 제목이 화면에서 가장 크다. 글자로 그려 어느 크기에서도 선명하다
export function Logo() {
  return (
    <View accessibilityRole="header" accessibilityLabel="밥BTI" className="flex-row items-center gap-2">
      <View className="h-8 w-8 items-center justify-center rounded-lg bg-primary">
        <Text className="text-base font-extrabold text-on-primary">밥</Text>
      </View>
      <Text className="text-xl font-extrabold tracking-tight text-text">BTI</Text>
    </View>
  );
}
