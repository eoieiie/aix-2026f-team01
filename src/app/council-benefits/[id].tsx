import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/button';
import { CouncilRecord } from '@/components/council-benefit';
import { IconButton } from '@/components/icon';
import { Text } from '@/components/text';
import { councilMapLinks, useCouncilBenefits } from '@/hooks/use-council-benefits';

// 가게 표에 연결되지 않은 공지도 원문과 검색 링크를 열 수 있다.
export default function CouncilBenefitScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const council = useCouncilBenefits();
  const entry = council.benefits.find((row) => String(row.id) === id);
  const name = entry?.shop_name ?? '';
  const links = councilMapLinks(name, entry?.location ?? null);
  const open = (url: string) => { void Linking.openURL(url).catch(() => {}); };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="px-4 py-3">
        <IconButton name="back" label="뒤로" onPress={() => router.canGoBack() ? router.back() : router.replace('/shops')} />
      </View>
      <ScrollView contentContainerClassName="gap-6 px-4 pb-8">
        {entry && name ? <>
          <Text className="text-3xl font-bold text-text">{name}</Text>
          <View className="gap-4 rounded-3xl bg-surface p-4">
            <Text className="text-lg font-bold text-text">학생회 제휴 혜택</Text>
            <CouncilRecord entry={entry} />
          </View>
          <View className="flex-row gap-2">
            <View className="flex-1"><Button label="네이버 지도" variant="secondary" onPress={() => open(links.naver)} /></View>
            <View className="flex-1"><Button label="카카오맵" variant="secondary" onPress={() => open(links.kakao)} /></View>
          </View>
        </> : council.isPending ? <Text className="text-sm text-muted">제휴를 불러오는 중</Text> : (
          <EmptyState title="제휴를 찾을 수 없어요" icon="shop" action={{ label: '가게 보러 가기', onPress: () => router.replace('/shops' as any) }} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
