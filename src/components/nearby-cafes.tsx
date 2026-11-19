import { Linking, Platform, Pressable, View } from 'react-native';
import { Text } from '@/components/text';

import { CouponCode } from '@/components/coupon-code';
import { Icon } from '@/components/icon';
import { kakaoMapUrl, useClaimCoupon, useSessionCafes } from '@/hooks/use-restaurants';

// 먹고 나서 카페 최대 3곳 (spec.md 4-23). "이 메뉴 파는 학교 앞" 바로 아래. 카페가 없거나 불러오지 못하면 칸을 그리지 않는다.
// 제휴 카페는 이름 바로 옆 "광고"와 쿠폰(식당과 같은 claim_coupon). 줄을 누르면 카카오맵
export function NearbyCafes({ sessionId, onPrimary = false }: { sessionId: string | null; onPrimary?: boolean }) {
  const list = useSessionCafes(sessionId);
  const claim = useClaimCoupon(sessionId ?? '');
  if (!sessionId || list.length === 0) return null;

  return (
    <View className={`gap-4 rounded-3xl p-5 ${onPrimary ? 'bg-on-primary' : 'bg-surface'}`}>
      <Text className="text-lg font-bold text-text">먹고 나서 카페</Text>
      {list.map((c) => (
        <View key={c.id} className="gap-2">
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`${c.name} 카카오맵에서 보기`}
            onPress={() => openMap(kakaoMapUrl(c))}
            className="min-h-11 flex-row items-center gap-3 active:opacity-70">
            <View className="flex-1 flex-row items-center gap-2">
              <Text className="shrink text-base font-bold text-text">{c.name}</Text>
              {c.partner ? (
                <View accessibilityLabel="광고" className="rounded-md border border-muted px-1.5">
                  <Text className="text-xs font-bold text-muted">광고</Text>
                </View>
              ) : null}
            </View>
            <Icon name="pin" size={22} color="muted" />
          </Pressable>
          {c.partner && c.couponText ? (
            c.myCode ? (
              <CouponCode code={c.myCode} shop={c.name} benefit={c.couponText} />
            ) : (
              <View className="flex-row items-center gap-3">
                <Text className="flex-1 text-sm text-text">{c.couponText}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${c.name} 쿠폰 받기`}
                  disabled={claim.isPending}
                  onPress={() => claim.mutate(c.id)}
                  className="h-11 items-center justify-center rounded-xl bg-ink px-4 active:opacity-80 disabled:opacity-50">
                  <Text className="text-sm font-bold text-on-ink">쿠폰 받기</Text>
                </Pressable>
              </View>
            )
          ) : null}
        </View>
      ))}
    </View>
  );
}

function openMap(url: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener');
    return;
  }
  Linking.openURL(url).catch(() => {});
}
