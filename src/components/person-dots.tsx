import { View } from 'react-native';

import { Avatar, type AvatarSize } from '@/components/avatar';
import { Text } from '@/components/text';
import { PERSON_DOTS_MAX } from '@/constants';

type PersonDotsProps = {
  // 들어온 순서대로의 이름
  names: string[];
  // names와 같은 순서의 사람 id. 주면 그 사람이 고른 아바타를 그린다 (4-27)
  userIds?: (string | null | undefined)[];
  // 겹친 동그라미 사이 고리 색. 놓이는 바탕과 같은 색을 준다 (회색 카드면 border-surface)
  ringClass?: 'border-surface' | 'border-primary' | 'border-background';
  // 목록 30, 카드 44
  size?: Extract<AvatarSize, 30 | 44>;
};

// 사람은 아바타(없으면 이름 첫 글자를 넣은 회색 동그라미)를 겹쳐 보인다. 넘치면 마지막 자리에 "+N".
// 주황은 쓰지 않는다. 주황은 화면마다 한 곳만 쓰는 포인트 색이다 (2026-11-25)
export function PersonDots({ names, userIds, ringClass = 'border-surface', size = 30 }: PersonDotsProps) {
  const shown = names.slice(0, PERSON_DOTS_MAX);
  const rest = names.length - shown.length;
  const ring = `rounded-full border-2 ${ringClass}`;

  return (
    <View className="flex-row" accessibilityLabel={`${names.length}명`}>
      {shown.map((name, i) => (
        <View key={`${i}-${name}`} className={`${ring} ${i > 0 ? '-ml-2' : ''}`}>
          <Avatar name={name} userId={userIds?.[i]} size={size} />
        </View>
      ))}
      {rest > 0 ? (
        <View className={`${ring} -ml-2`}>
          <View
            className="items-center justify-center rounded-full bg-surface-strong"
            style={{ width: size, height: size }}>
            <Text className="text-xs font-bold text-text">+{rest}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}
