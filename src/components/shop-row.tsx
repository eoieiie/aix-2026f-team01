import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AdBadge } from '@/components/ad-badge';
import { ShopThumb } from '@/components/shop-thumb';
import { Text } from '@/components/text';

// 가게 한 줄 (4-26). 왼쪽 그림, 이름과 "광고", 그 아래 한 줄 정보와 제휴 혜택. 누르면 가게 상세로 간다.
// 가게 탭 목록(그림 72, 회색 카드)과 판 결과의 식당·카페 줄(그림 56, 카드 안 줄)이 같이 쓴다
export function ShopRow({
  id,
  name,
  partner,
  info,
  benefit,
  photoUrl,
  thumbUrl,
  cuisine,
  thumbSize,
  card = false,
  onSurface = true,
}: {
  id: number;
  name: string;
  partner: boolean;
  info: string;
  benefit?: string | null;
  photoUrl: string | null;
  thumbUrl: string | null;
  cuisine: string | null;
  thumbSize: number;
  // 혼자 서는 카드면 회색 면과 안 여백을 준다. 카드 안의 줄이면 면 없이 그린다
  card?: boolean;
  // 줄이 놓인 바탕이 회색 면이면 true(그림 칸을 흰색으로), 흰 바탕이면 false(그림 칸을 회색으로)
  onSurface?: boolean;
}) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${name}${partner ? ', 광고' : ''}, 가게 정보 보기`}
      onPress={() => router.push(`/shops/${id}` as any)}
      className={`flex-row items-center gap-3 active:opacity-70 ${card ? 'rounded-2xl bg-surface p-4' : 'py-2'}`}>
      <ShopThumb name={name} photoUrl={photoUrl} thumbUrl={thumbUrl} cuisine={cuisine} size={thumbSize} onSurface={onSurface} />
      <View className="flex-1 gap-1">
        <View className="flex-row items-center gap-2">
          <Text className="shrink text-lg font-bold text-text" numberOfLines={1}>
            {name}
          </Text>
          {partner ? <AdBadge /> : null}
        </View>
        {info ? (
          <Text className="text-sm text-muted" numberOfLines={1}>
            {info}
          </Text>
        ) : null}
        {benefit ? (
          <Text className="text-sm font-semibold text-text" numberOfLines={1}>
            {benefit}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
