import { choiceSurface, webChoiceTextColor } from './choice-colors';
import colors from '@/constants/colors.json';

test('현재 선택의 글자와 배경은 흰색과 검정으로 맞춘다', () => {
  expect(webChoiceTextColor('text-base font-bold text-on-ink')).toEqual({ color: colors['on-ink'] });
  expect(choiceSurface(true)).toEqual({ backgroundColor: colors.ink });
  expect(choiceSurface(false)).toEqual({ backgroundColor: colors.surface });
  expect(choiceSurface(false, 'transparent')).toEqual({ backgroundColor: 'transparent' });
});

test('선택 해제하면 현재의 글자색으로 되돌아간다', () => {
  expect(webChoiceTextColor('text-base font-bold text-muted')).toEqual({ color: colors.muted });
  expect(webChoiceTextColor('text-base font-bold text-text')).toEqual({ color: colors.text });
  expect(webChoiceTextColor('text-xl')).toBeUndefined();
});
