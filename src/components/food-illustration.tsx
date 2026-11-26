import { useState } from 'react';
import { Image, View } from 'react-native';

import { useFoodImage } from '@/hooks/use-meal';

// 메뉴 그림 (0025). 주황 바탕 위에 흰 원을 두고 그 안에 그림을 둔다(그림 배경이 옅은 미색이라 주황 위에 바로 두면 네모가 드러난다).
// 그림이 없거나 못 받으면 아무것도 그리지 않는다. 결과 순간과 결과 카드에서만 쓴다
export function FoodIllustration({
  foodId,
  size,
  name,
  wrapClassName,
}: {
  foodId: number;
  size: number;
  name: string;
  // 그림이 있을 때만 감싸는 칸. 그림이 없으면 칸도 없어서 빈 여백이 생기지 않는다
  wrapClassName?: string;
}) {
  const url = useFoodImage(foodId);
  const [failed, setFailed] = useState(false);
  if (!url || failed) return null;
  const inner = Math.round(size * 0.92);
  const circle = (
    <View
      className="items-center justify-center overflow-hidden rounded-full bg-on-primary"
      style={{ width: size, height: size }}>
      <Image
        source={{ uri: url }}
        accessibilityLabel={`${name} 그림`}
        style={{ width: inner, height: inner, borderRadius: inner / 2 }}
        resizeMode="cover"
        onError={() => setFailed(true)}
      />
    </View>
  );
  return wrapClassName ? <View className={wrapClassName}>{circle}</View> : circle;
}
