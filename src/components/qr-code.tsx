import qrcode from 'qrcode-generator';
import Svg, { Path, Rect } from 'react-native-svg';

import colors from '@/constants/colors.json';

// QR 둘레의 빈칸. 4칸이 표준이라 카메라가 테두리를 잘 찾는다
const QUIET = 4;

// 글을 QR 칸으로 바꾼다. true가 검은 칸. 화면과 테스트가 같이 쓴다
export function qrModules(value: string): boolean[][] {
  const qr = qrcode(0, 'M');
  qr.addData(value);
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}

// 초대 주소를 담은 QR. 검은 칸을 경로 하나로 그려서 칸이 많아도 가볍다
export function QrCode({ value, size }: { value: string; size: number }) {
  const modules = qrModules(value);
  const total = modules.length + QUIET * 2;
  let d = '';
  modules.forEach((row, r) =>
    row.forEach((dark, c) => {
      if (dark) d += `M${c + QUIET} ${r + QUIET}h1v1h-1z`;
    })
  );

  // SVG는 className을 받지 못해서 색은 colors.json의 토큰 값으로 준다
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${total} ${total}`} accessibilityLabel="초대 QR">
      <Rect width={total} height={total} fill={colors.background} />
      <Path d={d} fill={colors.ink} />
    </Svg>
  );
}
