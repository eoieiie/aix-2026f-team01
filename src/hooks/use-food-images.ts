import { useQuery } from '@tanstack/react-query';

import { getFoodImageMap } from '@/api/food-images';

const EMPTY: Record<number, string> = {};

// 목록 칸 왼쪽의 음식 그림 주소 표. 그림 있는 음식(기본 40개 안팎)을 한 번에 받아 10분 둔다.
// 칸마다 따로 묻지 않아서 후보가 늘어도 요청은 한 번이다
export function useFoodImageMap(): Record<number, string> {
  const query = useQuery({
    queryKey: ['food-image-map'],
    queryFn: () => getFoodImageMap(),
    retry: false,
    staleTime: 10 * 60_000,
  });
  return query.data ?? EMPTY;
}
