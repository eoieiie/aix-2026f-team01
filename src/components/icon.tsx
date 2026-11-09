import { Pressable } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import colors from '@/constants/colors.json';

// 글 대신 쓰는 아이콘. 뜻이 분명한 넷만 둔다 (docs/design.md 4절 "글보다 아이콘")
// 선은 굵게(2.8). 얇은 선은 작은 화면에서 힘없어 보인다
const PATHS = {
  back: 'M15 5 L8 12 L15 19',
  plus: 'M12 5 V19 M5 12 H19',
  check: 'M5 12.5 L10 17.5 L19 7',
  close: 'M7 7 L17 17 M17 7 L7 17',
} as const;

export type IconName = keyof typeof PATHS;
type ColorName = keyof typeof colors;

// SVG는 className을 받지 못해서 색은 colors.json의 토큰 이름으로 받는다
export function Icon({
  name,
  size = 22,
  color = 'text',
}: {
  name: IconName;
  size?: number;
  color?: ColorName;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d={PATHS[name]}
        stroke={colors[color]}
        strokeWidth={2.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// 화면 위쪽의 둥근 아이콘 버튼 (뒤로, 모임 만들기). 읽어 주는 이름은 label로 남긴다
export function IconButton({
  name,
  label,
  onPress,
}: {
  name: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="h-12 w-12 items-center justify-center rounded-full bg-surface active:opacity-70">
      <Icon name={name} />
    </Pressable>
  );
}
