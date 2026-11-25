import { useState } from 'react';
import { Image, View } from 'react-native';

import { FoodDot } from '@/components/food-dot';
import { useFoodImageMap } from '@/hooks/use-food-images';

// 고르기 칸 40, 목록 줄 48, 카드 56 (docs/design.md "프레즐 규칙 그대로": 목록 칸 왼쪽 그림 48~72)
const SIZES = { xs: 40, sm: 48, md: 56 } as const;

type FoodThumbProps = {
  foodId: number;
  // 옆에 음식 이름 글자가 있을 때는 주지 않는다 (화면 읽기 프로그램이 두 번 읽지 않게)
  name?: string;
  size?: keyof typeof SIZES;
  // 서버가 이미 준 그림 주소가 있으면 그것을 쓴다 (식사 기록)
  imageUrl?: string | null;
};

// 목록 칸 왼쪽의 음식 그림. 글만 있는 칸은 얇아 보여서 넣었다 (2026-11-25 병주).
// 그림이 있으면 흰 원 안에 그림, 없으면(직접 적은 메뉴, 그림을 못 받음) 흰 원 안에 그 음식의 색 동그라미
export function FoodThumb({ foodId, name, size = 'md', imageUrl }: FoodThumbProps) {
  const map = useFoodImageMap();
  const [failed, setFailed] = useState(false);
  const url = imageUrl ?? map[foodId] ?? null;
  const px = SIZES[size];
  return (
    <View
      accessibilityLabel={name}
      className="items-center justify-center overflow-hidden rounded-full bg-background"
      style={{ width: px, height: px }}>
      {url && !failed ? (
        <Image
          source={{ uri: url }}
          style={{ width: px, height: px }}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <FoodDot foodId={foodId} size="sm" />
      )}
    </View>
  );
}
