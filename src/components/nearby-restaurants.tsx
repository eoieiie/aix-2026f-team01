import { View } from 'react-native';

import { CouponSlot } from '@/components/coupon-slot';
import { MoreShops } from '@/components/more-shops';
import { ShopRow } from '@/components/shop-row';
import { Text } from '@/components/text';
import { SHOP_ROW_THUMB_SIZE } from '@/constants';
import {
  type NearbyRestaurant,
  OSM_CREDIT,
  restaurantInfo,
  useClaimCoupon,
  useSessionRestaurants,
  useVoteRestaurants,
} from '@/hooks/use-restaurants';
import { type Shop, useMyCoupons, useShops } from '@/hooks/use-shops';

// 학교 앞 식당 (spec.md 4-21). 결과 뒤 칸과 투표 화면 추천 칸이 같은 줄 모양을 쓴다.
// 맞는 가게가 없거나 불러오지 못하면 칸을 그리지 않는다.
// 줄은 왼쪽 그림(가게 사진, 없으면 대표 메뉴 그림), 이름과 "광고", 한 줄 정보. 누르면 가게 상세로 간다 (4-26).
// 제휴 식당은 이름 바로 옆에 "광고"(공정위 추천·보증 심사지침: 경제적 이해관계는 추천 가까이)
// 순서는 서버가 정한다(0050): 메뉴가 맞는 가게 → 같은 종류 일반 가게 → 다른 음식 전문점, 묶음 안에서 쿠폰 가게, 내 학생회 제휴, 가까운 순.
// 학생회 제휴는 우리와 돈 관계가 없어 "광고" 없이 이름 옆 회색 표시와 혜택 줄(benefitLines, 말줄임 없음)

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
  const { shops } = useShops();
  const { coupons } = useMyCoupons();
  if (!sessionId || list.length === 0) return null;
  const byId = new Map(shops.map((s) => [s.id, s]));

  return (
    <View className={`gap-3 rounded-2xl p-4 ${onPrimary ? 'bg-on-primary' : 'bg-surface'}`}>
      <Text className="text-lg font-bold text-text">이 메뉴 파는 학교 앞</Text>
      {list.map((r) => (
        <View key={r.id} className="gap-2">
          <RestaurantRow r={r} shop={byId.get(r.id)} onSurface={!onPrimary} />
          {r.partner && r.couponText ? (
            <CouponSlot
              sessionId={sessionId}
              shopId={r.id}
              shopName={r.name}
              benefit={r.couponText}
              myCode={r.myCode}
              coupons={coupons}
              busy={claim.isPending}
              onClaim={() => claim.mutate(r.id)}
              onWhite={onPrimary}
            />
          ) : null}
        </View>
      ))}
      <MoreShops
        total={list[0].total}
        shown={list.length}
        menuName={list[0].menuName}
        menuCuisine={list[0].menuCuisine}
        onWhite={onPrimary}
      />
      <Text className="text-xs text-muted">{OSM_CREDIT}</Text>
    </View>
  );
}

// 투표 화면 아래 추천 칸. 후보 음식에 맞는 곳 중 내 취향으로 3곳. 보이기만 하고 투표와 룰렛 확률은 그대로다
export function VoteRestaurants({ sessionId, candidateKey }: { sessionId: string; candidateKey: string }) {
  const list = useVoteRestaurants(sessionId, candidateKey);
  const { shops } = useShops();
  if (list.length === 0) return null;
  const byId = new Map(shops.map((s) => [s.id, s]));

  return (
    <View className="gap-3 rounded-2xl bg-surface p-4">
      <Text className="text-lg font-bold text-text">학교 앞 추천</Text>
      {list.map((r) => (
        <RestaurantRow key={r.id} r={r} shop={byId.get(r.id)} onSurface />
      ))}
      <Text className="text-xs text-muted">{OSM_CREDIT}</Text>
    </View>
  );
}

// 줄 하나: 그림, 이름과 "광고", 아래에 걸어서 N분, 영업 중, 밥BTI로 간 모임 N팀을 간격으로 떨어뜨려.
// 그림은 가게 목록(4-26)에서 찾는다. 목록을 아직 못 읽었으면 아이콘으로 그린다
function RestaurantRow({ r, shop, onSurface }: { r: NearbyRestaurant; shop: Shop | undefined; onSurface: boolean }) {
  return (
    <ShopRow
      id={r.id}
      name={r.name}
      partner={r.partner}
      info={restaurantInfo(r)}
      benefit={r.partner ? null : r.councilText}
      photoUrl={shop?.photoUrl ?? r.photoUrl}
      thumbUrl={shop?.thumbUrl ?? null}
      cuisine={r.cuisine}
      thumbSize={SHOP_ROW_THUMB_SIZE}
      onSurface={onSurface}
    />
  );
}
