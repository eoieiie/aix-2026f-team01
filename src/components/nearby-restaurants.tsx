import { Image, Linking, Platform, Pressable, View } from 'react-native';
import { Text } from '@/components/text';

import { CouponCode } from '@/components/coupon-code';
import { Icon } from '@/components/icon';

import {
  kakaoMapUrl,
  type NearbyRestaurant,
  OSM_CREDIT,
  restaurantInfo,
  useClaimCoupon,
  useSessionRestaurants,
  useVoteRestaurants,
} from '@/hooks/use-restaurants';

// 학교 앞 식당 (spec.md 4-21). 결과 뒤 칸과 투표 화면 추천 칸이 같은 줄 모양을 쓴다.
// 맞는 가게가 없거나 불러오지 못하면 칸을 그리지 않는다.
// 제휴 식당은 이름 바로 옆에 "광고"(공정위 추천·보증 심사지침: 경제적 이해관계는 추천 가까이)와 사진 한 장.

// 결과 뒤 "이 메뉴 파는 학교 앞" 최대 3곳. 쿠폰은 끝난 판에서만 받는다.
// onPrimary: 결과 순간(주황 바탕) 위에 흰 카드로. 주황은 화면 바탕 하나만 쓴다
export function NearbyRestaurants({
  sessionId,
  onPrimary = false,
}: {
  sessionId: string | null;
  onPrimary?: boolean;
}) {
  const list = useSessionRestaurants(sessionId);
  const claim = useClaimCoupon(sessionId ?? '');
  if (!sessionId || list.length === 0) return null;

  return (
    <View className={`gap-4 rounded-3xl p-5 ${onPrimary ? 'bg-on-primary' : 'bg-surface'}`}>
      <Text className="text-lg font-bold text-text">이 메뉴 파는 학교 앞</Text>
      {list.map((r) => (
        <View key={r.id} className="gap-2">
          <RestaurantRow r={r} />
          {r.partner && r.couponText ? (
            r.myCode ? (
              <CouponCode code={r.myCode} shop={r.name} benefit={r.couponText} />
            ) : (
              <View className="flex-row items-center gap-3">
                <Text className="flex-1 text-sm text-text">{r.couponText}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${r.name} 쿠폰 받기`}
                  disabled={claim.isPending}
                  onPress={() => claim.mutate(r.id)}
                  className="h-11 items-center justify-center rounded-xl bg-ink px-4 active:opacity-80 disabled:opacity-50">
                  <Text className="text-sm font-bold text-on-ink">쿠폰 받기</Text>
                </Pressable>
              </View>
            )
          ) : null}
        </View>
      ))}
      <Text className="text-xs text-muted">{OSM_CREDIT}</Text>
    </View>
  );
}

// 투표 화면 아래 추천 칸. 후보 음식에 맞는 곳 중 내 취향으로 3곳. 보이기만 하고 투표와 룰렛 확률은 그대로다
export function VoteRestaurants({ sessionId, candidateKey }: { sessionId: string; candidateKey: string }) {
  const list = useVoteRestaurants(sessionId, candidateKey);
  if (list.length === 0) return null;

  return (
    <View className="gap-4 rounded-3xl bg-surface p-5">
      <Text className="text-lg font-bold text-text">학교 앞 추천</Text>
      {list.map((r) => (
        <RestaurantRow key={r.id} r={r} />
      ))}
      <Text className="text-xs text-muted">{OSM_CREDIT}</Text>
    </View>
  );
}

// 줄 하나: (제휴면 사진) 이름과 "광고", 아래에 걸어서 N분 · 영업 중 · 밥BTI로 간 모임 N팀.
// 줄을 누르면 카카오맵에서 그 가게가 열린다. 웹은 새 탭
function RestaurantRow({ r }: { r: NearbyRestaurant }) {
  const info = restaurantInfo(r);
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${r.name} 카카오맵에서 보기`}
      onPress={() => openMap(kakaoMapUrl(r))}
      className="min-h-11 flex-row items-center gap-3 active:opacity-70">
      {r.photoUrl ? (
        <Image
          source={{ uri: r.photoUrl }}
          style={{ width: 56, height: 56, borderRadius: 12 }}
          resizeMode="cover"
          accessibilityLabel={`${r.name} 사진`}
        />
      ) : null}
      <View className="flex-1 gap-1">
        <View className="flex-row items-center gap-2">
          <Text className="shrink text-base font-bold text-text">{r.name}</Text>
          {r.partner ? (
            <View accessibilityLabel="광고" className="rounded-md border border-muted px-1.5">
              <Text className="text-xs font-bold text-muted">광고</Text>
            </View>
          ) : null}
        </View>
        {info ? <Text className="text-sm text-muted">{info}</Text> : null}
      </View>
      <Icon name="pin" size={22} color="muted" />
    </Pressable>
  );
}

function openMap(url: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener');
    return;
  }
  Linking.openURL(url).catch(() => {});
}
