import { useLocalSearchParams, useRouter } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { Image, Linking, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  couponErrorText,
  couponForShop,
  formatOpeningHours,
  kakaoRouteUrl,
  naverMapUrl,
  shopLine,
  shortAddress,
  telUrl,
} from '@/hooks/use-shops';
import { AdBadge } from '@/components/ad-badge';
import { Button } from '@/components/button';
import { CouponCode } from '@/components/coupon-code';
import { Icon, IconButton, type IconName } from '@/components/icon';
import { ShopThumb } from '@/components/shop-thumb';
import { Text } from '@/components/text';
import { TextPieces } from '@/components/text-pieces';
import { COUPON_VALID_HOURS } from '@/constants';
import { OSM_CREDIT } from '@/hooks/use-restaurants';
import { type ShopDetail, useClaimShopCoupon, useMyCoupons, useShop } from '@/hooks/use-shops';

const HERO_HEIGHT = 208;
const HERO_THUMB = 144;

// 가게 상세 (4-26). 큰 사진(없으면 음식 그림), 이름, 종류와 걸어서 몇 분, 제휴 혜택과 쿠폰, 가게 정보, 길찾기 단추 둘.
// 가게 정보는 공공데이터와 오픈스트리트맵, 사진은 사장님이 주거나 팀이 찍은 것만 쓴다
export default function ShopScreen() {
  const router = useRouter();
  const { id: raw } = useLocalSearchParams<{ id: string }>();
  const id = /^[0-9]+$/.test(String(raw)) ? Number(raw) : null;
  const shop = useShop(id);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/shops' as any));

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center px-4 py-3">
        <IconButton name="back" label="뒤로" onPress={back} />
      </View>
      {shop.isLoading ? (
        <Text className="px-4 text-sm text-muted">가게를 불러오는 중</Text>
      ) : shop.isError || !shop.data ? (
        <View className="gap-3 px-4">
          <Text className="text-base font-bold text-text">가게를 불러올 수 없어요</Text>
          <Button label="다시 시도" variant="secondary" onPress={() => shop.refetch()} />
        </View>
      ) : (
        <ShopBody shop={shop.data} />
      )}
    </SafeAreaView>
  );
}

function ShopBody({ shop }: { shop: ShopDetail }) {
  const { coupons } = useMyCoupons();
  const claim = useClaimShopCoupon();
  const [claimError, setClaimError] = useState<string | null>(null);
  const coupon = couponForShop(coupons, shop.id, new Date());
  const hours = formatOpeningHours(shop.openingHours);
  const address = shortAddress(shop.address);
  const line = shopLine(shop);

  return (
    <ScrollView contentContainerClassName="gap-6 px-4 pb-16">
      <Hero shop={shop} />

      <View className="gap-2">
        <View className="flex-row items-center gap-2">
          <Text className="shrink text-3xl font-bold tracking-tight text-text">{shop.name}</Text>
          {shop.partner ? <AdBadge /> : null}
        </View>
        <TextPieces pieces={line} className="text-base text-muted" />
      </View>

      {shop.partner && shop.couponText ? (
        <View className="gap-3 rounded-2xl bg-surface p-4">
          <View className="gap-1">
            <Text className="text-sm font-semibold text-muted">제휴 혜택</Text>
            <Text className="text-lg font-bold text-text">{shop.couponText}</Text>
          </View>
          {coupon ? (
            <CouponCode code={coupon.code} shop={shop.name} benefit={coupon.benefit} coupon={coupon} />
          ) : (
            <Button
              label="쿠폰 받기"
              loading={claim.isPending}
              onPress={() => {
                setClaimError(null);
                claim.mutate(shop.id, { onError: (e) => setClaimError(couponErrorText(e)) });
              }}
            />
          )}
          {claimError ? <Text className="text-sm font-semibold text-danger">{claimError}</Text> : null}
          <Text className="text-xs text-muted">{`하루 한 장, 받고 ${COUPON_VALID_HOURS}시간 안에 가게에서 보여 주세요`}</Text>
        </View>
      ) : null}

      <View className="gap-4 rounded-2xl bg-surface p-4">
        {address ? <InfoRow icon="pin">{address}</InfoRow> : null}
        {shop.phone ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`${shop.name}에 전화 걸기 ${shop.phone}`}
            onPress={() => openUrl(telUrl(shop.phone as string))}
            className="active:opacity-70">
            <InfoRow icon="phone">{shop.phone}</InfoRow>
          </Pressable>
        ) : null}
        {hours ? <InfoRow icon="clock">{hours.join('\n')}</InfoRow> : null}
        {shop.menus.length > 0 ? <InfoRow label="대표 메뉴">{shop.menus.join(', ')}</InfoRow> : null}
        {shop.licensedYear ? <InfoRow label="영업 신고">{`${shop.licensedYear}년`}</InfoRow> : null}
        {shop.visits ? <InfoRow label="밥BTI">{`모임 ${shop.visits}팀이 쿠폰을 쓰고 다녀갔어요`}</InfoRow> : null}
        {!address && !shop.phone && !hours && shop.menus.length === 0 && !shop.licensedYear ? (
          <Text className="text-base text-muted">아직 모은 정보가 없어요</Text>
        ) : null}
      </View>

      {/* 같은 역할은 같은 폭: 길찾기 단추 둘 */}
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Button label="네이버 지도" variant="secondary" onPress={() => openUrl(naverMapUrl(shop))} />
        </View>
        <View className="flex-1">
          <Button label="카카오맵" variant="secondary" onPress={() => openUrl(kakaoRouteUrl(shop))} />
        </View>
      </View>

      <Text className="text-xs text-muted">{OSM_CREDIT}</Text>
    </ScrollView>
  );
}

// 큰 그림 칸. 사진이 있으면 옆으로 넘기고, 없으면 회색 면 가운데에 음식 그림(없으면 아이콘)
function Hero({ shop }: { shop: ShopDetail }) {
  const [width, setWidth] = useState(0);
  if (shop.photos.length === 0) {
    return (
      <View className="items-center justify-center rounded-2xl bg-surface" style={{ height: HERO_HEIGHT }}>
        <ShopThumb
          name={shop.name}
          photoUrl={null}
          thumbUrl={shop.thumbUrl}
          cuisine={shop.cuisine}
          size={HERO_THUMB}
          onSurface
        />
      </View>
    );
  }
  return (
    <View className="gap-2" onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        className="rounded-2xl bg-surface"
        style={{ height: HERO_HEIGHT }}>
        {shop.photos.map((p, i) => (
          <Image
            key={p.url}
            source={{ uri: p.url }}
            accessibilityLabel={`${shop.name} 사진 ${i + 1}`}
            style={{ width: width || 320, height: HERO_HEIGHT }}
            resizeMode="cover"
          />
        ))}
      </ScrollView>
      {shop.photos[0].credit ? <Text className="text-xs text-muted">{shop.photos[0].credit}</Text> : null}
    </View>
  );
}

// 정보 한 줄: 왼쪽에 아이콘이나 짧은 이름(같은 폭), 오른쪽에 값
function InfoRow({ icon, label, children }: { icon?: IconName; label?: string; children: ReactNode }) {
  return (
    <View className="min-h-6 flex-row gap-3">
      <View className="w-16">
        {icon ? <Icon name={icon} size={22} color="muted" /> : <Text className="text-sm font-semibold text-muted">{label}</Text>}
      </View>
      <Text className="flex-1 text-base text-text">{children}</Text>
    </View>
  );
}

function openUrl(url: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && !url.startsWith('tel:')) {
    window.open(url, '_blank', 'noopener');
    return;
  }
  Linking.openURL(url).catch(() => {});
}
