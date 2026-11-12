import { useQuery } from '@tanstack/react-query';

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
