import { Pressable } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import colors from '@/constants/colors.json';

// 글 대신 쓰는 아이콘. 뜻이 분명한 것만 둔다 (docs/design.md 4절 "글보다 아이콘")
// 선은 굵게(2.8). 얇은 선은 작은 화면에서 힘없어 보인다
const PATHS = {
  back: 'M15 5 L8 12 L15 19',
  plus: 'M12 5 V19 M5 12 H19',
  minus: 'M5 12 H19',
  check: 'M5 12.5 L10 17.5 L19 7',
  close: 'M7 7 L17 17 M17 7 L7 17',
  link: 'M10 14 L14 10 M8.5 11.5 L6.8 13.2 A3.5 3.5 0 0 0 11.8 18.2 L13.5 16.5 M15.5 12.5 L17.2 10.8 A3.5 3.5 0 0 0 12.2 5.8 L10.5 7.5',
  qr: 'M4 4 H10 V10 H4 Z M14 4 H20 V10 H14 Z M4 14 H10 V20 H4 Z M14 14 H15 M19 14 H20 M14 19 H15 M19 19 H20 M16.5 16.5 H17.5',
  pencil: 'M5 19 L6 14.5 L15.5 5 L19 8.5 L9.5 18 Z M13.5 7 L17 10.5',
  home: 'M4 11 L12 4.5 L20 11 V19.5 H14.5 V14.5 H9.5 V19.5 H4 Z',
  person: 'M12 12 A4 4 0 1 0 12 4 A4 4 0 1 0 12 12 Z M4.5 20 C5.5 16.5 8.5 15 12 15 C15.5 15 18.5 16.5 19.5 20',
  pin: 'M12 21 C12 21 5 14.5 5 9.5 A7 7 0 0 1 19 9.5 C19 14.5 12 21 12 21 Z M12 12 A2.5 2.5 0 1 0 12 7 A2.5 2.5 0 1 0 12 12 Z',
  more: 'M5 12 H5.01 M12 12 H12.01 M19 12 H19.01',
  refresh: 'M20 12 A8 8 0 0 1 6.5 18.5 L4 16 M4 21 V16 H9 M4 12 A8 8 0 0 1 17.5 5.5 L20 8 M20 3 V8 H15',
  // 가게 탭과 쿠폰 (4-26, 4-27)
  shop: 'M4 10 L5.5 4.5 H18.5 L20 10 M4 10 A2.67 2.67 0 0 0 9.33 10 A2.67 2.67 0 0 0 14.67 10 A2.67 2.67 0 0 0 20 10 M5.5 12.5 V19.5 H18.5 V12.5 M10 19.5 V15.5 H14 V19.5',
  ticket: 'M4 7 H20 V10 A2 2 0 0 0 20 14 V17 H4 V14 A2 2 0 0 0 4 10 Z M14.5 7.5 V9 M14.5 11.25 V12.75 M14.5 15 V16.5',
  phone: 'M6.5 4 H9.5 L11 8 L9 9.5 C10 11.8 12.2 14 14.5 15 L16 13 L20 14.5 V17.5 C20 18.9 18.9 20 17.5 20 C10.6 20 4 13.4 4 6.5 C4 5.1 5.1 4 6.5 4 Z',
  search: 'M10.5 17 A6.5 6.5 0 1 0 10.5 4 A6.5 6.5 0 1 0 10.5 17 Z M15.5 15.5 L20 20',
  cup: 'M5 8 H16 V14 A4 4 0 0 1 12 18 H9 A4 4 0 0 1 5 14 Z M16 9.5 H17.5 A2.5 2.5 0 0 1 17.5 14.5 H16 M8 4 V5.5 M12 4 V5.5 M4 21 H17',
  // 그림 없는 식당 칸 (수저). 종류 이름은 바로 옆 줄에 있어 글로 되풀이하지 않는다
  meal: 'M8 10.5 A2.5 3.5 0 1 0 8 3.5 A2.5 3.5 0 1 0 8 10.5 Z M8 10.5 V20.5 M14.5 3.5 L15.5 20.5 M18.5 3.5 L17.5 20.5',
  clock: 'M12 20.5 A8.5 8.5 0 1 0 12 3.5 A8.5 8.5 0 1 0 12 20.5 Z M12 7.5 V12 L15 14',
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
