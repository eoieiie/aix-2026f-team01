import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  claimShopCoupon,
  getAdminBoard,
  getAdminColleges,
  getMyCoupons,
  getOwnerBoard,
  getShop,
  getShops,
  redeemCoupon,
} from '@/api/shops';

// 화면이 쓰는 계산 함수. 화면은 src/api를 직접 부르지 않는다
export { shortShopName } from '@/api/shop-name';
export {
  couponErrorText,
  cuisineLabel,
  couponForSession,
  couponForShop,
  couponState,
  filterShops,
  formatKoreanTime,
  formatOpeningHours,
  kakaoRouteUrl,
  naverMapUrl,
  redeemRate,
  SHOP_KINDS,
  shopLine,
  shortAddress,
  splitCoupons,
  telUrl,
  timeLeft,
} from '@/api/shops';

export type { AdminBoard, CollegeRow, Coupon, CouponState, OwnerBoard, Shop, ShopDetail, ShopKind } from '@/api/shops';

// 가게 목록 (4-26). 동네는 서버가 내 최근 모임으로 정한다. 판 결과의 식당 줄도 이 목록에서 그림을 찾는다
export function useShops() {
  const query = useQuery({ queryKey: ['shops'], queryFn: () => getShops(), staleTime: 5 * 60_000, retry: false });
  return { shops: query.data ?? [], isLoading: query.isLoading, isError: query.isError, refetch: query.refetch };
}

export function useShop(id: number | null) {
  return useQuery({
    queryKey: ['shop', id],
    queryFn: () => getShop(id as number),
    enabled: id !== null,
    retry: false,
    staleTime: 60_000,
  });
}

// 쿠폰함 (4-27). 못 읽으면 빈 목록이다
export function useMyCoupons() {
  const query = useQuery({ queryKey: ['my-coupons'], queryFn: () => getMyCoupons(), retry: false, staleTime: 15_000 });
  return { coupons: query.data ?? [], isLoading: query.isLoading, isError: query.isError, refetch: query.refetch };
}

export function useClaimShopCoupon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (restaurantId: number) => claimShopCoupon(restaurantId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['my-coupons'] }),
  });
}

// 직원 확인. 끝나면 쿠폰함과 판 결과의 쿠폰 칸을 다시 읽는다
export function useRedeemCoupon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ couponId, pin }: { couponId: string; pin: string | null }) => redeemCoupon(couponId, pin),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['my-coupons'] });
      queryClient.invalidateQueries({ queryKey: ['shop'] });
    },
  });
}

// 운영자 현황판 (4-28). 30초마다 다시 읽는다
export function useAdminBoard(days: number, area: string | null) {
  return useQuery({
    queryKey: ['admin-coupon-board', days, area],
    queryFn: () => getAdminBoard(days, area),
    retry: false,
    refetchInterval: 30_000,
  });
}

export function useAdminColleges(days: number, area: string | null) {
  return useQuery({
    queryKey: ['admin-coupon-colleges', days, area],
    queryFn: () => getAdminColleges(days, area),
    retry: false,
    refetchInterval: 30_000,
  });
}

export function useOwnerBoard(token: string) {
  return useQuery({
    queryKey: ['owner-board', token],
    queryFn: () => getOwnerBoard(token),
    enabled: token.length > 0,
    retry: false,
    refetchInterval: 60_000,
  });
}
