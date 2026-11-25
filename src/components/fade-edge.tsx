import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

// 아래 버튼 띠나 탭 막대 바로 위에서 글이 칼로 자른 듯 끊기지 않게, 바탕색으로 옅어지는 짧은 띠 (2026-11-25 병주 "저렇게 잘리는 부분 없으면 좋겠음").
// 누르기를 막지 않는다(pointerEvents none). 새 패키지 없이 react-native-svg로 그린다.
// edge: 'bottom'은 감싼 칸의 아래 끝에 붙고, 'above'는 감싼 칸 바로 위로 나가 붙는다(탭 막대 위)
export function FadeEdge({ color, edge = 'bottom', height = 24 }: { color: string; edge?: 'bottom' | 'above'; height?: number }) {
  // 화면에 여러 개가 있어도 섞이지 않게 색마다 다른 이름
  const id = `fade-${color.replace(/[^0-9A-Za-z]/g, '')}`;
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, right: 0, height, ...(edge === 'bottom' ? { bottom: 0 } : { bottom: '100%' }) }}>
      <Svg width="100%" height={height}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0} />
            <Stop offset="1" stopColor={color} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height={height} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}
