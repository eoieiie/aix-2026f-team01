import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';

import { Text } from '@/components/text';

// 결과 뒤 가게와 카페 칸의 "더 보기" 한 줄 (4-21, 4-23, 0048). 3곳보다 많을 때만 그린다.
// 누르면 가게 탭을 연다. 식당 칸은 메뉴 이름으로 찾은 채(같은 종류 가게까지), 카페 칸은 카페만 고른 채
export function MoreShops({
  total,
  shown,
  menuName = null,
  menuCuisine = null,
  kind = null,
  onWhite,
}: {
  total: number;
  shown: number;
  menuName?: string | null;
  menuCuisine?: string | null;
  kind?: 'cafe' | null;
  // 흰 카드 안이면 회색 면, 회색 카드 안이면 흰 면
  onWhite: boolean;
}) {
  const router = useRouter();
  if (total <= shown) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`가게 ${total}곳 더 보기`}
      onPress={() => {
        // at: 같은 메뉴로 다시 눌러도 가게 탭이 찾기 칸을 다시 채우게
        const params: Record<string, string> = { at: String(Date.now()) };
        if (menuName) params.q = menuName;
        if (menuName && menuCuisine) params.cuisine = menuCuisine;
        if (kind) params.kind = kind;
        router.push({ pathname: '/shops', params } as any);
      }}
      className={`h-12 items-center justify-center rounded-xl active:opacity-70 ${onWhite ? 'bg-surface' : 'bg-background'}`}>
      <Text className="text-base font-bold text-text">{`더 보기 (${total}곳)`}</Text>
    </Pressable>
  );
}
