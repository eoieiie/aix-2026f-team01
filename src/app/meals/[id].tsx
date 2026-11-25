import { useRef } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Platform, ScrollView, View } from 'react-native';
import { Text } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { IconButton } from '@/components/icon';
import { NearbyCafes } from '@/components/nearby-cafes';
import { NearbyRestaurants } from '@/components/nearby-restaurants';
import { ResultCard } from '@/components/result-card';
import { ShareButton } from '@/components/share-button';
import colors from '@/constants/colors.json';
import { MealError, mealErrorMessage, mealShareText, useMealCard } from '@/hooks/use-meal';
import { useMealSessionId } from '@/hooks/use-restaurants';

// 공유 글에 넣는 링크는 앱 첫 화면. 카드 주소는 모임 사람만 열린다
function webBase() {
  return (
    process.env.EXPO_PUBLIC_WEB_BASE ||
    (Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : 'https://babti.expo.app')
  );
}

// 결과 카드 화면 (spec.md 4-17, 7절 /meals/{식사 id}). 하단 탭은 없다
export default function MealScreen() {
  const cardRef = useRef<View>(null);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { card, isLoading, error, retry } = useMealCard(id ?? '');
  const sessionId = useMealSessionId(id ?? '');
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={colors.primary} accessibilityLabel="결과 카드를 불러오는 중" />
      </SafeAreaView>
    );
  }

  if (error || !card) {
    // 없는 기록과 소속 아님은 다시 해도 같아서 홈으로, 연결 문제는 다시 시도
    const known = error instanceof MealError;
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-background px-6">
        <Text className="text-lg font-bold text-text">{mealErrorMessage(error)}</Text>
        <View className="w-full max-w-xs">
          {known ? (
            <Button label="홈으로" onPress={() => router.replace('/')} />
          ) : (
            <Button label="다시 시도" variant="secondary" onPress={() => retry()} />
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center px-4 py-3">
        <IconButton name="back" label="뒤로" onPress={back} />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerClassName="gap-4 px-4 pb-10 pt-2">
        <Text className="text-3xl font-bold tracking-tight text-text">이번 끼니</Text>
        {/* 그림 공유는 이 칸을 찍는다(4-25). collapsable={false}: 안드로이드에서 칸이 사라지지 않게 */}
        <View ref={cardRef} collapsable={false}>
          <ResultCard card={card} />
        </View>
        <ShareButton text={mealShareText(card, webBase())} captureRef={cardRef} />
        <NearbyRestaurants sessionId={sessionId} foodName={card.foodName} />
        <NearbyCafes sessionId={sessionId} />
      </ScrollView>
    </SafeAreaView>
  );
}
