import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { HEADCOUNT_MAX, HEADCOUNT_MIN } from '@/constants';

// 먹을 인원수 고르기. 빼기, 숫자, 더하기. 누르는 곳은 48로 손가락 기준(44)보다 크게 둔다
export function HeadcountStepper({
  value,
  onChange,
  big = false,
  disabled = false,
}: {
  value: number;
  onChange: (next: number) => void;
  big?: boolean;
  disabled?: boolean;
}) {
  const step = (d: number) => {
    const next = Math.min(HEADCOUNT_MAX, Math.max(HEADCOUNT_MIN, value + d));
    if (next !== value) onChange(next);
  };
  const round = (name: 'minus' | 'plus', d: number, label: string, off: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off }}
      disabled={off}
      onPress={() => step(d)}
      className={`${big ? 'h-16 w-16' : 'h-12 w-12'} items-center justify-center rounded-full ${
        big ? 'bg-surface' : 'bg-background'
      } active:opacity-70 ${off ? 'opacity-40' : ''}`}>
      <Icon name={name} size={big ? 28 : 22} />
    </Pressable>
  );
  return (
    <View className="flex-row items-center gap-2">
      {round('minus', -1, '한 명 빼기', disabled || value <= HEADCOUNT_MIN)}
      <Text
        accessibilityLabel={`${value}명`}
        className={`${big ? 'min-w-28 text-6xl' : 'min-w-14 text-xl'} text-center font-extrabold tracking-tight text-text`}>
        {value}
        <Text className={big ? 'text-3xl' : 'text-base'}>명</Text>
      </Text>
      {round('plus', 1, '한 명 더하기', disabled || value >= HEADCOUNT_MAX)}
    </View>
  );
}
