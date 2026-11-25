import { View } from 'react-native';

import { CouponSlot } from '@/components/coupon-slot';
import { MoreShops } from '@/components/more-shops';
import { ShopRow } from '@/components/shop-row';
import { Text } from '@/components/text';
import { SHOP_ROW_THUMB_SIZE } from '@/constants';
import { useClaimCoupon, useSessionCafes } from '@/hooks/use-restaurants';
import { shopLine, useMyCoupons, useShops } from '@/hooks/use-shops';

// 먹고 나서 카페 최대 3곳 (spec.md 4-23). "이 메뉴 파는 학교 앞" 바로 아래. 카페가 없거나 불러오지 못하면 칸을 그리지 않는다.
// 제휴 카페는 이름 바로 옆 "광고"와 쿠폰(식당과 같은 claim_coupon). 줄을 누르면 가게 상세로 간다 (4-26)
// 순서는 서버가 정한다(0048): 쿠폰 카페, 내 학생회 제휴 카페(이름 옆 회색 표시와 혜택 한 줄), 가까운 순. 더 있으면 "더 보기"로 가게 탭의 카페
export function NearbyCafes({ sessionId, onPrimary = false }: { sessionId: string | null; onPrimary?: boolean }) {
  const list = useSessionCafes(sessionId);
  const claim = useClaimCoupon(sessionId ?? '');
  const { shops } = useShops();
  const { coupons } = useMyCoupons();
  if (!sessionId || list.length === 0) return null;
  const byId = new Map(shops.map((s) => [s.id, s]));

  return (
    <View className={`gap-3 rounded-2xl p-4 ${onPrimary ? 'bg-on-primary' : 'bg-surface'}`}>
      <Text className="text-lg font-bold text-text">먹고 나서 카페</Text>
      {list.map((c) => {
        const shop = byId.get(c.id);
        return (
          <View key={c.id} className="gap-2">
            <ShopRow
              id={c.id}
              name={c.name}
              partner={c.partner}
              info={shop ? shopLine(shop) : ['카페']}
              benefit={c.partner ? null : c.councilText}
              photoUrl={shop?.photoUrl ?? null}
              thumbUrl={shop?.thumbUrl ?? null}
              cuisine="cafe"
              thumbSize={SHOP_ROW_THUMB_SIZE}
              onSurface={!onPrimary}
            />
            {c.partner && c.couponText ? (
              <CouponSlot
                sessionId={sessionId}
                shopId={c.id}
                shopName={c.name}
                benefit={c.couponText}
                myCode={c.myCode}
                coupons={coupons}
                busy={claim.isPending}
                onClaim={() => claim.mutate(c.id)}
                onWhite={onPrimary}
              />
            ) : null}
          </View>
        );
      })}
      <MoreShops total={list[0].total} shown={list.length} kind="cafe" onWhite={onPrimary} />
    </View>
  );
}
