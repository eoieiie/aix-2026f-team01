import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';

import { Text } from '@/components/text';
import { filterShops, useShops } from '@/hooks/use-shops';

// 결과 뒤 가게와 카페 칸의 "더 보기" 한 줄 (4-21, 4-23, 0048).
// 누르면 가게 탭을 연다. 식당 칸은 메뉴 이름으로 찾은 채, 카페 칸은 카페만 고른 채.
// 숫자는 열리는 가게 탭 목록과 같게, 가게 탭과 같은 거르기 함수(filterShops)로 센다(2026-11-25 병주: 닭갈비 판 "139곳"이 열린 목록과 달랐다).
// 그 수가 결과에 이미 보인 줄 수 이하이면 그리지 않는다
export function MoreShops({
  shown,
  menuName = null,
  kind = null,
  onWhite,
}: {
  shown: number;
  menuName?: string | null;
  kind?: 'cafe' | null;
  // 흰 카드 안이면 회색 면, 회색 카드 안이면 흰 면
  onWhite: boolean;
}) {
  const router = useRouter();
  const { shops } = useShops();
  if (!menuName && !kind) return null;
  const total = filterShops(shops, kind ?? 'all', kind ? '' : (menuName ?? '')).length;
  if (total <= shown) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`가게 ${total}곳 더 보기`}
      onPress={() => {
        // at: 같은 메뉴로 다시 눌러도 가게 탭이 찾기 칸을 다시 채우게
        const params: Record<string, string> = { at: String(Date.now()) };
        if (kind) params.kind = kind;
        else if (menuName) params.q = menuName;
        router.push({ pathname: '/shops', params } as any);
      }}
      className={`h-12 items-center justify-center rounded-xl active:opacity-70 ${onWhite ? 'bg-surface' : 'bg-background'}`}>
      <Text className="text-base font-bold text-text">{`더 보기 (${total}곳)`}</Text>
    </Pressable>
  );
}
