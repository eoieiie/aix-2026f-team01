import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { couponState, formatKoreanTime, splitCoupons } from '@/api/shops';
import { Button } from '@/components/button';
import { CouponCode } from '@/components/coupon-code';
import { IconButton } from '@/components/icon';
import { Text } from '@/components/text';
import { type Coupon, useMyCoupons } from '@/hooks/use-shops';

// 쿠폰함 (4-27). 지금 쓸 수 있는 쿠폰은 코드와 "직원 확인"까지, 지난 쿠폰은 한 줄씩
export default function CouponsScreen() {
  const router = useRouter();
  const { coupons, isLoading, isError, refetch } = useMyCoupons();
  const { ready, past } = useMemo(() => splitCoupons(coupons, new Date()), [coupons]);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/shops' as any));

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center px-4 py-3">
        <IconButton name="back" label="뒤로" onPress={back} />
      </View>
      <ScrollView contentContainerClassName="gap-6 px-4 pb-16">
        <Text className="text-3xl font-bold tracking-tight text-text">쿠폰함</Text>

        {isLoading ? (
          <Text className="text-sm text-muted">쿠폰을 불러오는 중</Text>
        ) : isError ? (
          <View className="gap-3">
            <Text className="text-base font-bold text-text">쿠폰을 불러올 수 없어요</Text>
            <Button label="다시 시도" variant="secondary" onPress={() => refetch()} />
          </View>
        ) : ready.length === 0 ? (
          <View className="items-center gap-4 rounded-2xl bg-surface p-6">
            <Text className="text-xl font-bold tracking-tight text-text">쓸 수 있는 쿠폰이 없어요</Text>
            <Button label="가게 보러 가기" className="self-center px-8" onPress={() => router.replace('/(tabs)/shops' as any)} />
          </View>
        ) : (
          <View className="gap-3">
            {ready.map((c) => (
              <CouponCode key={c.id} code={c.code} shop={c.shopName} benefit={c.benefit} coupon={c} onBackground />
            ))}
          </View>
        )}

        {past.length > 0 ? (
          <View className="gap-3">
            <Text className="text-lg font-bold text-text">지난 쿠폰</Text>
            <View className="gap-2">
              {past.map((c) => (
                <PastRow key={c.id} coupon={c} onPress={() => router.push(`/shops/${c.restaurantId}` as any)} />
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

// 지난 쿠폰 한 줄: 가게 이름, 혜택, 쓴 때나 지난 까닭. 누르면 그 가게로 간다
function PastRow({ coupon, onPress }: { coupon: Coupon; onPress: () => void }) {
  const state = couponState(coupon, new Date());
  const status =
    state === 'used'
      ? `${formatKoreanTime(coupon.redeemedAt ?? '')}에 썼어요`
      : state === 'locked'
        ? '비밀번호를 여러 번 틀려 잠겼어요'
        : '기한이 지났어요';
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${coupon.shopName}, ${coupon.benefit}, ${status}`}
      onPress={onPress}
      className="gap-1 rounded-2xl bg-surface p-4 active:opacity-70">
      <Text className="text-base font-bold text-text">{coupon.shopName}</Text>
      <Text className="text-sm text-text">{coupon.benefit}</Text>
      <Text className="text-xs font-semibold text-muted">{status}</Text>
    </Pressable>
  );
}
