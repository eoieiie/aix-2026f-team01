import { useState } from 'react';
import { Image, View } from 'react-native';

import { Icon } from '@/components/icon';
import { TINT_BG, type Tint } from '@/constants/food-tint';

// 가게 그림 칸 (4-26). 가게 사진 → 이름이나 대표 메뉴로 찾은 음식 그림(카페는 카페 그림) → 중립 칸 순으로 그린다.
// 중립 칸은 옅은 면에 옅은 회색 아이콘 하나(식당은 수저, 카페는 잔). 엉뚱한 음식 그림을 대신 넣지 않는다(0040, 0041).
// 사진이 한 장도 없어도 칸이 비어 보이지 않는다. 사진은 사장님이 주거나 팀이 찍은 것만 올라온다
export function ShopThumb({
  name,
  photoUrl,
  thumbUrl,
  cuisine,
  size,
  onSurface = true,
  tint,
}: {
  name: string;
  photoUrl: string | null;
  thumbUrl: string | null;
  cuisine: string | null;
  size: number;
  // 회색 카드 위면 흰 칸, 흰 바탕 위면 회색 칸으로 그려 칸이 보이게 한다
  onSurface?: boolean;
  // 음식 색 (docs/design.md "음식 색"): 주면 칸을 그 옅은 색으로 칠한다. 카드 안 줄처럼 줄 자체에 면이 없을 때 쓴다
  tint?: Tint;
}) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);
  const box = { width: size, height: size };
  const tile = `items-center justify-center overflow-hidden rounded-xl ${tint ? TINT_BG[tint] : onSurface ? 'bg-background' : 'bg-surface'}`;

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

  // 중립 칸에는 글을 쓰지 않는다. 종류 이름은 바로 옆(아래) 줄에 이미 있다
  return (
    <View className={tile} style={box} accessibilityLabel={`${name} 그림 없음`}>
      <Icon name={cuisine === 'cafe' ? 'cup' : 'meal'} size={Math.round(size * 0.42)} color="food-4" />
    </View>
  );
}
