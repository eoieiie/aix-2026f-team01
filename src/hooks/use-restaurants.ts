import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  claimCoupon,
  getSessionCafes,
  getSessionIdForMeal,
  getSessionRestaurants,
  pickForMe,
} from '@/api/restaurants';
import { useMyStats } from '@/hooks/use-stats';

export type { NearbyCafe, NearbyRestaurant } from '@/api/restaurants';
export { kakaoMapUrl, OSM_CREDIT, restaurantInfo } from '@/api/restaurants';

// 판의 학교 앞 식당 (4-21). 실패하거나 서버에 함수가 없으면 빈 목록이고 칸을 숨긴다.
// candidateKey: 투표 화면은 후보가 바뀌면 다시 읽는다. 결과 뒤에는 비워 둔다
export function useSessionRestaurants(sessionId: string | null, candidateKey = '') {
  const query = useQuery({
    queryKey: ['session-restaurants', sessionId, candidateKey],
    queryFn: () => getSessionRestaurants(sessionId as string),
    enabled: !!sessionId,
    retry: false,
    staleTime: 60_000,
  });
  return query.data ?? [];
}

// 투표 화면 추천 칸 (4-21). 서버가 준 곳 중 내 네 글자 축과 먹은 기록으로 3곳.
// 내 기록을 못 읽으면 취향 없이 서버 순서대로
export function useVoteRestaurants(sessionId: string, candidateKey: string) {
  const list = useSessionRestaurants(sessionId, candidateKey);
  const { stats } = useMyStats();
  return pickForMe(list, {
    axes: stats?.profile.axes ?? null,
    eatenFoodIds: new Set((stats?.foods ?? []).map((f) => f.foodId)),
  });
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
      // 쿠폰함과 쿠폰 칸의 "직원 확인"이 바로 붙게 (4-27)
      queryClient.invalidateQueries({ queryKey: ['my-coupons'] });
    },
  });
}
