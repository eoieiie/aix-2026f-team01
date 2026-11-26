import { useQuery } from '@tanstack/react-query';

import { getFoodImageUrl } from '@/api/food-images';
import { getMealCard, getMealIdForSession } from '@/api/meals';

export type { MealCard, MealPerson } from '@/api/meals';
export {
  MealError,
  mealDateLabel,
  mealErrorMessage,
  mealShareText,
  monthCuisineLine,
  togetherLines,
} from '@/api/meals';

// 결과 카드 숫자 (4-17)
export function useMealCard(mealId: string) {
  const query = useQuery({
    queryKey: ['meal-card', mealId],
    queryFn: () => getMealCard(mealId),
    enabled: !!mealId,
    retry: false,
  });
  return { card: query.data, isLoading: query.isPending, error: query.error, retry: () => query.refetch() };
}

// 끝난 판의 식사 기록 id. 결과 순간의 "결과 카드" 버튼이 쓴다
export function useSessionMealId(sessionId: string, done: boolean) {
  const query = useQuery({
    queryKey: ['session-meal-id', sessionId],
    queryFn: () => getMealIdForSession(sessionId),
    enabled: done && !!sessionId,
    retry: 2,
  });
  return query.data ?? null;
}

// 메뉴 그림 주소 (0025). 결과 순간과 결과 카드에서만 쓴다. 없거나 실패하면 null
export function useFoodImage(foodId: number | null | undefined) {
  const query = useQuery({
    queryKey: ['food-image', foodId],
    queryFn: () => getFoodImageUrl(foodId as number),
    enabled: typeof foodId === 'number' && foodId > 0,
    retry: false,
    staleTime: 10 * 60_000,
  });
  return query.data ?? null;
}
