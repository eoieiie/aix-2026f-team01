import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { couponState, formatKoreanTime, timeLeft } from '@/hooks/use-shops';
import { RedeemSheet } from '@/components/redeem-sheet';
import { Text } from '@/components/text';
import type { Coupon } from '@/hooks/use-shops';

// 받은 쿠폰을 가게 직원에게 보여 주는 칸 (spec.md 4-21, 4-23, 4-27). 코드는 멀리서도 읽히게 크게.
// coupon이 있으면 남은 시간과 "직원 확인"이 붙고, 쓰고 나면 쓴 시각이 남는다.
// coupon이 없으면(쿠폰함을 아직 못 읽었거나 예전 서버) 코드만 보인다
export function CouponCode({
  code,
  shop,
  benefit,
  coupon,
  onBackground = false,
}: {
  code: string;
  shop: string;
  benefit: string;
  coupon?: Coupon | null;
  // 흰 바탕 위에 바로 놓이면 회색 면, 회색 카드 안이면 흰 면
  onBackground?: boolean;
}) {
  const [now, setNow] = useState(() => new Date());
  const [sheet, setSheet] = useState(false);
  // 남은 시간은 1분마다 다시 센다
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const state = coupon ? couponState(coupon, now) : null;
  const dim = state === 'used' || state === 'expired' || state === 'locked';
  const status =
    !coupon || state === null
      ? null
      : state === 'used'
        ? `${formatKoreanTime(coupon.redeemedAt ?? '')}에 썼어요`
        : state === 'expired'
          ? '기한이 지났어요'
          : state === 'locked'
            ? '비밀번호를 여러 번 틀려 잠겼어요'
            : timeLeft(coupon.expiresAt, now);

  return (
    <View
      accessible={!coupon || dim}
      accessibilityLabel={`${shop} 쿠폰 코드 ${code.split('').join(' ')}, ${benefit}${status ? ', ' + status : ''}`}
      className={`items-center gap-2 rounded-2xl p-4 ${onBackground ? 'bg-surface' : 'bg-background'}`}>
      <Text className="text-sm font-bold text-text">{shop}</Text>
      <Text className={`text-4xl font-bold tracking-widest ${dim ? 'text-muted' : 'text-text'}`}>{code}</Text>
      <Text className="text-center text-sm text-text">{benefit}</Text>
      {status ? <Text className="text-xs font-semibold text-muted">{status}</Text> : null}
      {coupon && state === 'ready' ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${shop} 쿠폰 직원 확인`}
            onPress={() => setSheet(true)}
            className="h-12 w-full items-center justify-center rounded-lg bg-ink active:opacity-80">
            <Text className="text-base font-bold text-on-ink">직원 확인</Text>
          </Pressable>
          <RedeemSheet coupon={coupon} visible={sheet} onClose={() => setSheet(false)} />
        </>
      ) : null}
    </View>
  );
}
