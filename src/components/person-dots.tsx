import { Text, View } from 'react-native';

import { PERSON_DOTS_MAX } from '@/constants';

// 사람마다 돌려 쓰는 주황·살구 톤 아바타
const DOT_COLORS = [
  { bg: 'bg-food-1', text: 'text-on-primary' },
  { bg: 'bg-food-7', text: 'text-on-primary' },
  { bg: 'bg-food-3', text: 'text-text' },
] as const;

type PersonDotsProps = {
  // 들어온 순서대로의 이름
  names: string[];
  // 겹친 동그라미 사이 고리 색. 놓이는 바탕과 같은 색을 준다 (회색 카드면 border-surface)
  ringClass?: 'border-surface' | 'border-primary' | 'border-background';
};

// 사람은 이름 첫 글자를 넣은 회색 동그라미를 겹쳐 보인다. 넘치면 마지막 자리에 "+N"
export function PersonDots({ names, ringClass = 'border-surface' }: PersonDotsProps) {
  const shown = names.slice(0, PERSON_DOTS_MAX);
  const rest = names.length - shown.length;
  const dot = `h-10 w-10 items-center justify-center rounded-full border-[3px] ${ringClass}`;

  return (
    <View className="flex-row" accessibilityLabel={`${names.length}명`}>
      {shown.map((name, i) => {
        const color = DOT_COLORS[i % DOT_COLORS.length];
        return (
          <View key={`${i}-${name}`} className={`${dot} ${color.bg} ${i > 0 ? '-ml-2.5' : ''}`}>
            <Text className={`text-sm font-bold ${color.text}`}>{Array.from(name)[0] ?? ''}</Text>
          </View>
        );
      })}
      {rest > 0 ? (
        <View className={`${dot} -ml-2.5 bg-food-6`}>
          <Text className="text-sm font-bold text-text">+{rest}</Text>
        </View>
      ) : null}
    </View>
  );
}
