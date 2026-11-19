import { forwardRef } from 'react';
import {
  Platform,
  Text as RNText,
  TextInput as RNTextInput,
  type TextInputProps,
  type TextProps,
} from 'react-native';

// 모든 글자를 Pretendard로 (docs/design.md 글꼴, 2026-11-19).
// 앱은 빌드 때 넣은 Pretendard(400, 600, 700, 800)를 이름 하나와 굵기(font-bold 등)로 고른다 (app.json expo-font).
// 웹은 public/index.html의 Pretendard 웹 글꼴을 쓰고, 받기 전에는 시스템 글꼴로 먼저 그린다.
// 글꼴이 없는 예전 앱(1.0.0 (6) 이하)은 시스템 글꼴로 그대로 보인다.
export const FONT_FAMILY =
  Platform.OS === 'web'
    ? 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif'
    : 'Pretendard';

const base = { fontFamily: FONT_FAMILY };

export const Text = forwardRef<RNText, TextProps>(function Text({ style, ...rest }, ref) {
  return <RNText ref={ref} style={[base, style]} {...rest} />;
});

export const TextInput = forwardRef<RNTextInput, TextInputProps>(function TextInput(
  { style, ...rest },
  ref
) {
  return <RNTextInput ref={ref} style={[base, style]} {...rest} />;
});
