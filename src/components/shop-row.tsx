import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AdBadge } from '@/components/ad-badge';
import { CouncilBadge } from '@/components/council-benefit';
import { shortShopName } from '@/hooks/use-shops';
import { benefitLines, councilBadge, useCouncilBenefits } from '@/hooks/use-council-benefits';
import { ShopThumb } from '@/components/shop-thumb';
import { Text } from '@/components/text';
import { TextPieces } from '@/components/text-pieces';

// 가게 한 줄 (4-26). 왼쪽 그림, 이름 바로 옆에 "광고"(혜택이 있는 제휴만)와 학생회 제휴 표시(같은 역할, 같은 자리와 크기),
// 그 아래 정보 줄과 혜택 줄들(benefitLines). 말줄임 없이 줄바꿈하고, 이름은 지점 꼬리를 뗀 이름(shortShopName). 누르면 가게 상세로 간다.
// 가게 탭 목록(그림 72, 회색 카드)과 판 결과의 식당·카페 줄(그림 56, 카드 안 줄)이 같이 쓴다
export function ShopRow({
  id,
  name,
  partner,
  info,
  benefit,
  photoUrl,
  thumbUrl,
  cuisine,
  thumbSize,
  card = false,
  hideCouncilBadge = false,
  onOpen,
  onSurface = true,
}: {
  id: number;
  name: string;
  partner: boolean;
  // 이름 아래 조각들(종류, 걸어서 몇 분, 영업 중). 기호 없이 간격으로 떨어뜨린다
  info: readonly string[];
  benefit?: string | null;
  photoUrl: string | null;
  thumbUrl: string | null;
  cuisine: string | null;
  thumbSize: number;
  // 혼자 서는 카드면 회색 면과 안 여백을 준다. 카드 안의 줄이면 면 없이 그린다
  card?: boolean;
  hideCouncilBadge?: boolean;
  onOpen?: () => void;
  // 줄이 놓인 바탕이 회색 면이면 true(그림 칸을 흰색으로), 흰 바탕이면 false(그림 칸을 회색으로)
  onSurface?: boolean;
}) {
  const router = useRouter();
  const { benefits } = useCouncilBenefits();
  const lines = benefitLines(benefit);
  const shown = shortShopName(name);
  const colleges = hideCouncilBadge ? [] : [...new Set(benefits.filter((b) => b.restaurant_id === id).map((b) => b.college))];
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${shown}${partner ? ', 광고' : ''}${colleges.map((c) => `, ${councilBadge(c)}`).join('')}, 가게 정보 보기`}
      onPress={onOpen ?? (() => router.push(`/shops/${id}` as any))}
      className={`flex-row items-center gap-3 active:opacity-70 ${card ? 'rounded-3xl bg-surface p-4' : 'py-2'}`}>
      <ShopThumb name={name} photoUrl={photoUrl} thumbUrl={thumbUrl} cuisine={cuisine} size={thumbSize} onSurface={onSurface} />
      <View className="flex-1 gap-1">
        {/* 이름 옆 표시: 이름이 길면 표시가 다음 줄로 넘어간다(말줄임 없음) */}
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="text-lg font-bold text-text">{shown}</Text>
          {partner ? <AdBadge /> : null}
          {colleges.map((c) => <CouncilBadge key={c} college={c} inline />)}
        </View>
        {info.length ? <TextPieces pieces={info} /> : null}
        {lines.map((l, i) => (
          <Text key={i} className="text-sm font-semibold text-text">
            {l}
          </Text>
        ))}
      </View>
    </Pressable>
  );
}
