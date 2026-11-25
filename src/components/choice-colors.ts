import type { TextStyle, ViewStyle } from 'react-native';

import colors from '@/constants/colors.json';

// 웹에서 상태가 바뀔 때 이전 유틸리티가 DOM에 남을 수 있다. 현재 상태의 색을 직접 그린다.
const TEXT_COLORS = {
  'text-on-ink': colors['on-ink'],
  'text-text': colors.text,
  'text-muted': colors.muted,
} as const;

export function webChoiceTextColor(className?: string): TextStyle | undefined {
  const token = className?.split(/\s+/).findLast((name) => Object.hasOwn(TEXT_COLORS, name));
  return token ? { color: TEXT_COLORS[token as keyof typeof TEXT_COLORS] } : undefined;
}

export function choiceSurface(selected: boolean, off: 'surface' | 'transparent' = 'surface'): ViewStyle {
  return { backgroundColor: selected ? colors.ink : off === 'transparent' ? off : colors.surface };
}
