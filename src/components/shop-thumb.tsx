import { useState } from 'react';
import { Image, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { cuisineLabel } from '@/hooks/use-shops';

// 가게 그림 칸 (4-26). 가게 사진 → 이름이나 대표 메뉴로 찾은 음식 그림(카페는 카페 그림) → 중립 칸 순으로 그린다.
// 중립 칸은 옅은 면에 종류 이름 한 단어(한식 등), 종류를 모르면 아이콘. 엉뚱한 음식 그림을 대신 넣지 않는다(0040).
// 사진이 한 장도 없어도 칸이 비어 보이지 않는다. 사진은 사장님이 주거나 팀이 찍은 것만 올라온다
export function ShopThumb({
  name,
  photoUrl,
  thumbUrl,
  cuisine,
  size,
  onSurface = true,
}: {
  name: string;
  photoUrl: string | null;
  thumbUrl: string | null;
  cuisine: string | null;
  size: number;
  // 회색 카드 위면 흰 칸, 흰 바탕 위면 회색 칸으로 그려 칸이 보이게 한다
  onSurface?: boolean;
}) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);
  const box = { width: size, height: size };
  const tile = `items-center justify-center overflow-hidden rounded-xl ${onSurface ? 'bg-background' : 'bg-surface'}`;

  if (photoUrl && !photoFailed) {
    return (
      <View className={tile} style={box}>
        <Image
          source={{ uri: photoUrl }}
          accessibilityLabel={`${name} 사진`}
          style={box}
          resizeMode="cover"
          onError={() => setPhotoFailed(true)}
        />
      </View>
    );
  }

  if (thumbUrl && !thumbFailed) {
    // 음식 그림은 바탕이 옅은 미색이라 동그랗게 잘라 칸 안에 둔다 (food-illustration과 같은 방식)
    const inner = Math.round(size * 0.84);
    return (
      <View className={tile} style={box}>
        <Image
          source={{ uri: thumbUrl }}
          accessibilityLabel={`${name} 대표 메뉴 그림`}
          style={{ width: inner, height: inner, borderRadius: inner / 2 }}
          resizeMode="cover"
          onError={() => setThumbFailed(true)}
        />
      </View>
    );
  }

  const kind = cuisineLabel(cuisine);
  return (
    <View className={tile} style={box} accessibilityLabel={`${name} 그림 없음`}>
      {kind ? (
        <Text className={`font-bold text-muted ${size >= 96 ? 'text-2xl' : 'text-base'}`} numberOfLines={1}>
          {kind}
        </Text>
      ) : (
        <Icon name={cuisine === 'cafe' ? 'cup' : 'shop'} size={Math.round(size * 0.42)} color="muted" />
      )}
    </View>
  );
}
