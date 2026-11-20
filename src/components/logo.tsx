import { View } from 'react-native';
import { Text } from '@/components/text';

// 앱 로고. 글자만 쓰고 "밥"만 주황 (2026-11-16 병주 결정 1안, docs/decisions.md). 홈 위쪽 한 곳에만 둔다.
// 위쪽 줄(높이 48) 안에서 세로 가운데로 맞추고, 아래 제목보다 작게 둔다
export function Logo() {
  return (
    <View accessibilityRole="header" accessibilityLabel="밥BTI" className="h-12 flex-row items-center">
      <Text
        className="text-2xl font-extrabold leading-tight tracking-tight text-text"
        style={{ includeFontPadding: false }}>
        <Text className="text-primary">밥</Text>BTI
      </Text>
    </View>
  );
}
