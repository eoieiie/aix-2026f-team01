import { Pressable, Text, View } from 'react-native';

import {
  OSM_CREDIT,
  restaurantLine,
  useClaimCoupon,
  useSessionRestaurants,
} from '@/hooks/use-restaurants';

// 결과 뒤 "이 메뉴 파는 학교 앞" 식당 최대 3곳 (spec.md 4-21). 맞는 가게가 없거나 불러오지 못하면 칸을 그리지 않는다.
// 제휴 식당은 이름 바로 옆에 "광고"(공정위 추천·보증 심사지침: 경제적 이해관계는 추천 가까이), 쿠폰 받기.
// onPrimary: 결과 순간(주황 바탕) 위에 흰 카드로. 주황은 화면 바탕 하나만 쓴다
export function NearbyRestaurants({
  sessionId,
  foodName,
  onPrimary = false,
}: {
  sessionId: string | null;
  foodName: string;
  onPrimary?: boolean;
}) {
  const list = useSessionRestaurants(sessionId);
  const claim = useClaimCoupon(sessionId ?? '');
  if (!sessionId || list.length === 0) return null;

  return (
    <View className={`gap-4 rounded-3xl p-5 ${onPrimary ? 'bg-on-primary' : 'bg-surface'}`}>
      <Text className="text-lg font-extrabold text-text">이 메뉴 파는 학교 앞</Text>
      {list.map((r) => {
        const line = restaurantLine(r, foodName);
        const code = r.myCode;
        return (
          <View key={r.id} className="gap-2">
            <View className="flex-row items-center gap-2">
              <Text className="shrink text-base font-bold text-text" numberOfLines={1}>
                {r.name}
              </Text>
              {r.partner ? (
                <View accessibilityLabel="광고" className="rounded-md border border-muted px-1.5">
                  <Text className="text-xs font-bold text-muted">광고</Text>
                </View>
              ) : null}
            </View>
            {line ? <Text className="text-sm text-muted">{line}</Text> : null}
            {r.partner && r.couponText ? (
              <View className="flex-row items-center gap-3">
                <Text className="flex-1 text-sm text-text">{r.couponText}</Text>
                {code ? (
                  <Text accessibilityLabel={`쿠폰 코드 ${code}`} className="text-base font-extrabold tracking-widest text-text">
                    {code}
                  </Text>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${r.name} 쿠폰 받기`}
                    disabled={claim.isPending}
                    onPress={() => claim.mutate(r.id)}
                    className="h-11 items-center justify-center rounded-full bg-ink px-4 active:opacity-80 disabled:opacity-50">
                    <Text className="text-sm font-bold text-on-ink">쿠폰 받기</Text>
                  </Pressable>
                )}
              </View>
            ) : null}
          </View>
        );
      })}
      <Text className="text-xs text-muted">{OSM_CREDIT}</Text>
    </View>
  );
}
