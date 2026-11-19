import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { claimCoupon, getSessionCafes, getSessionIdForMeal, getSessionRestaurants } from '@/api/restaurants';

export type { NearbyCafe, NearbyRestaurant } from '@/api/restaurants';
export { kakaoMapUrl, OSM_CREDIT, restaurantLine } from '@/api/restaurants';

// 결과가 나온 판의 학교 앞 식당 (4-21). 실패하거나 서버에 함수가 없으면 빈 목록이고 칸을 숨긴다
export function useSessionRestaurants(sessionId: string | null) {
  const query = useQuery({
    queryKey: ['session-restaurants', sessionId],
    queryFn: () => getSessionRestaurants(sessionId as string),
    enabled: !!sessionId,
    retry: false,
    staleTime: 60_000,
  });
  return query.data ?? [];
}

// 결과가 나온 판의 학교 앞 카페 (4-23). 실패하거나 서버에 함수가 없으면 빈 목록이고 칸을 숨긴다
export function useSessionCafes(sessionId: string | null) {
  const query = useQuery({
    queryKey: ['session-cafes', sessionId],
    queryFn: () => getSessionCafes(sessionId as string),
    enabled: !!sessionId,
    retry: false,
    staleTime: 60_000,
  });
  return query.data ?? [];
}

export function useMealSessionId(mealId: string) {
  const query = useQuery({
    queryKey: ['meal-session-id', mealId],
    queryFn: () => getSessionIdForMeal(mealId),
    enabled: !!mealId,
    retry: false,
  });
  return query.data ?? null;
}

export function useClaimCoupon(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (restaurantId: number) => claimCoupon(sessionId, restaurantId),
    // 식당과 카페 쿠폰이 같은 함수라 두 목록을 같이 다시 읽는다
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['session-restaurants', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['session-cafes', sessionId] });
    },
  });
}
