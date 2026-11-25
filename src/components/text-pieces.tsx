import { View } from 'react-native';

import { Text } from '@/components/text';

// 한 줄에 놓는 작은 글자 조각들 (2026-11-25). "한식", "걸어서 3분", "영업 중"을 간격 8로 떨어뜨려 놓는다.
// 조각 사이에 가운뎃점 같은 기호를 넣지 않는다. 빈 조각은 빼고, 다 비면 아무것도 그리지 않는다
export function TextPieces({
  pieces,
  className = 'text-sm text-muted',
}: {
  pieces: readonly string[];
  className?: string;
}) {
  const shown = pieces.filter((p) => p.trim() !== '');
  if (shown.length === 0) return null;
  return (
    <View accessible accessibilityLabel={shown.join(', ')} className="flex-row flex-wrap gap-x-2">
      {shown.map((p, i) => (
        <Text key={`${i}-${p}`} className={className} numberOfLines={1}>
          {p}
        </Text>
      ))}
    </View>
  );
}
