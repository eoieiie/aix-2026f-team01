import { useQuery } from '@tanstack/react-query';

import { foodImagePublicUrl, getFoodImageMap } from '@/api/food-images';

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

// 서버에 묻지 않고 기본 음식 그림 주소를 만든다. 기본 음식 그림 파일 이름은 음식 번호다 (0026).
// 로그인 없이 여는 소개 화면(4-30)의 예시 조각에만 쓴다
export function baseFoodImageMap(ids: readonly number[]): Record<number, string> {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const out: Record<number, string> = {};
  if (!base) return out;
  for (const id of ids) {
    const url = foodImagePublicUrl(base, `${id}.webp`);
    if (url) out[id] = url;
  }
  return out;
}
