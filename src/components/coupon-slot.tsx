import { Pressable, View } from 'react-native';

import { couponForSession } from '@/api/shops';
import { CouponCode } from '@/components/coupon-code';
import { Text } from '@/components/text';
import type { Coupon } from '@/hooks/use-shops';

// 판 결과의 제휴 식당·카페 줄 아래 쿠폰 칸 (4-21, 4-23, 4-27).
// 아직 안 받았으면 혜택 한 줄과 "쿠폰 받기", 받았으면 코드와 "직원 확인"
export function CouponSlot({
  sessionId,
  shopId,
  shopName,
  benefit,
  myCode,
  coupons,
  busy,
  onClaim,
  onWhite,
}: {
  sessionId: string;
  shopId: number;
  shopName: string;
  benefit: string;
  myCode: string | null;
  coupons: readonly Coupon[];
  busy: boolean;
  onClaim: () => void;
  // 흰 카드 안이면 쿠폰 칸을 회색 면으로, 회색 카드 안이면 흰 면으로
  onWhite: boolean;
}) {
  if (myCode) {
    return (
      <CouponCode
        code={myCode}
        shop={shopName}
        benefit={benefit}
        coupon={couponForSession(coupons, sessionId, shopId)}
        onBackground={onWhite}
      />
    );
  }
  return (
    <View className="flex-row items-center gap-3">
      <Text className="flex-1 text-sm text-text">{benefit}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${shopName} 쿠폰 받기`}
        disabled={busy}
        onPress={onClaim}
        className="h-11 items-center justify-center rounded-lg bg-ink px-4 active:opacity-80 disabled:opacity-50">
        <Text className="text-sm font-bold text-on-ink">쿠폰 받기</Text>
      </Pressable>
    </View>
  );
}
