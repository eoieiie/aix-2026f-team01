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
  shortShopName,
  telUrl,
} from '@/hooks/use-shops';
import { AdBadge } from '@/components/ad-badge';
import { Button } from '@/components/button';
import { CouncilBadge, CouncilRecord } from '@/components/council-benefit';
import { useCouncilBenefits } from '@/hooks/use-council-benefits';
import { CouponCode } from '@/components/coupon-code';
import { Icon, IconButton, type IconName } from '@/components/icon';
import { ShopThumb } from '@/components/shop-thumb';
import { shopTint, TINT_BG } from '@/constants/food-tint';
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
          <Text className="text-base font-semibold text-text">가게를 불러올 수 없어요</Text>
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
  const council = useCouncilBenefits().benefits.filter((b) => b.restaurant_id === shop.id);
  const [claimError, setClaimError] = useState<string | null>(null);
  const coupon = couponForShop(coupons, shop.id, new Date());
  const hours = formatOpeningHours(shop.openingHours);
  const address = shortAddress(shop.address);
  const line = shopLine(shop);

  return (
    <ScrollView contentContainerClassName="gap-6 px-4 pb-16">
      <Hero shop={shop} />

      <View className="gap-2">
        {/* 제목은 지점 꼬리를 뗀 이름(shortShopName). 지도 링크와 찾기는 원래 이름 */}
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="text-3xl font-bold tracking-tight text-text">{shortShopName(shop.name)}</Text>
          {shop.partner ? <AdBadge /> : null}
        </View>
        {council.length ? <View className="flex-row flex-wrap gap-1">{[...new Set(council.map((b) => b.college))].map((c) => <CouncilBadge key={c} college={c} />)}</View> : null}
        <TextPieces pieces={line} className="text-base text-muted" />
      </View>

      {council.length ? (
        <View className="gap-4 rounded-3xl bg-surface p-4">
          <Text className="text-lg font-bold text-text">학생회 제휴 혜택</Text>
          {council.map((entry) => <CouncilRecord key={entry.id} entry={entry} showBadge={new Set(council.map((b) => b.college)).size > 1} />)}
        </View>
      ) : null}

      {shop.partner && shop.couponText ? (
        <View className="gap-3 rounded-3xl bg-surface p-4">
          <View className="gap-1">
            <Text className="text-sm text-muted">제휴 혜택</Text>
            <Text className="text-lg font-semibold text-text">{shop.couponText}</Text>
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
          {claimError ? <Text className="text-sm text-danger">{claimError}</Text> : null}
          <Text className="text-xs text-muted">{`하루 한 장, 받고 ${COUPON_VALID_HOURS}시간 안에 가게에서 보여 주세요`}</Text>
        </View>
      ) : null}

      <View className="gap-4 rounded-3xl bg-surface p-4">
        {address ? <InfoRow icon="pin" label="주소">{address}</InfoRow> : null}
        {shop.phone ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`${shop.name}에 전화 걸기 ${shop.phone}`}
            onPress={() => openUrl(telUrl(shop.phone as string))}
            className="active:opacity-70">
            <InfoRow icon="phone" label="전화">{shop.phone}</InfoRow>
          </Pressable>
        ) : null}
        {hours ? <InfoRow icon="clock" label="영업시간">{hours.join('\n')}</InfoRow> : null}
        {shop.menus.length > 0 ? <InfoRow icon="meal" label="대표 메뉴">{shop.menus.join(', ')}</InfoRow> : null}
        {shop.visits ? <InfoRow icon="ticket" label="밥BTI 쿠폰을 쓴 모임">{`모임 ${shop.visits}팀이 쿠폰을 쓰고 다녀갔어요`}</InfoRow> : null}
        {!address && !shop.phone && !hours && shop.menus.length === 0 ? (
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
      <View className={`items-center justify-center rounded-3xl ${TINT_BG[shopTint(shop.cuisine)]}`} style={{ height: HERO_HEIGHT }}>
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
        className={`rounded-3xl ${TINT_BG[shopTint(shop.cuisine)]}`}
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

// 정보 한 줄: 왼쪽에 아이콘 하나(모든 줄 같은 크기), 오른쪽에 값. 이름은 읽어 주기로만 붙인다
function InfoRow({ icon, label, children }: { icon: IconName; label?: string; children: ReactNode }) {
  return (
    <View
      accessible
      accessibilityLabel={label && typeof children === 'string' ? `${label}, ${children}` : undefined}
      className="min-h-6 flex-row items-start gap-3">
      <Icon name={icon} size={22} color="muted" />
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
