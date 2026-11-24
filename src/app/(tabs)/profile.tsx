import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/text';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AccountSheet } from '@/components/account-sheet';
import { Button } from '@/components/button';
import { FoodDot } from '@/components/food-dot';
import { ProfileSummaryCard } from '@/components/profile-summary-card';
import { SettingsList } from '@/components/settings-list';
import colors from '@/constants/colors.json';
import { TAB_BAR_SPACE } from '@/constants';
import { authorityTitle, levelOf, typeLetters, useMyStats } from '@/hooks/use-stats';

// 내 프로필 탭 (4-15, #41). 네 글자, 레벨과 숫자, 먹어본 음식 도감, 같이 먹은 사람, 그리고 설정 줄
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { stats, isLoading, isError, refetch } = useMyStats();
  const [accountVisible, setAccountVisible] = useState(false);
  const [subTab, setSubTab] = useState<'foods' | 'companions'>('foods');

  // 못 먹는 것이나 온보딩에서 돌아오면 다시 읽는다
  useFocusEffect(
    useCallback(() => {
      refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={colors.primary} accessibilityLabel="프로필을 불러오는 중" />
      </SafeAreaView>
    );
  }

  if (isError || !stats) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-background px-6">
        <Text className="text-lg font-bold text-text">프로필을 불러올 수 없어요</Text>
        <View className="w-full max-w-xs">
          <Button label="다시 시도" variant="secondary" onPress={() => refetch()} />
        </View>
      </SafeAreaView>
    );
  }

  const total = stats.foods.reduce((s, f) => s + f.mealCount, 0);
  const { level, toNext } = levelOf(total);
  const letters = stats.profile.axes ? typeLetters(stats.profile.axes, stats.profile.quizAnswers) : null;
  const toOnboarding = () => router.push('/onboarding?from=profile' as any);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets
        contentContainerClassName="gap-8 px-5 pt-3"
        // 아래 안전 영역(홈 막대) 위에 탭이 떠 있으니 그만큼 더 비운다. 아이폰에서 마지막 설정 줄이 탭에 가렸다(11/20 실기기)
        contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE + insets.bottom }}
        showsVerticalScrollIndicator={false}>
        <View className="h-12 justify-center">
          <Text className="text-3xl font-bold tracking-tight text-text">내 프로필</Text>
        </View>

        <ProfileSummaryCard
          letters={letters}
          name={stats.profile.displayName ?? '이름 없음'}
          handle={stats.profile.handle}
          title={authorityTitle(stats.foods)}
          level={level}
          toNext={toNext}
          action={
            letters ? null : <Button label="내 네 글자 만들기" variant="inverse" onPress={toOnboarding} />
          }
        />

        <View className="flex-row gap-2">
          <Stat value={total} label="총 끼니" />
          <Stat value={stats.foods.length} label="음식 도감" />
          <Stat value={stats.companions.length} label="밥 친구" />
        </View>

        {/* 기록 탭: 음식 도감과 밥 친구 랭킹을 세그먼트 탭으로 전환 */}
        <View className="gap-3">
          <View className="flex-row rounded-2xl bg-surface p-1.5">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`음식 도감 ${stats.foods.length}개`}
              onPress={() => setSubTab('foods')}
              className={`flex-1 items-center justify-center rounded-xl py-3 active:opacity-80 ${
                subTab === 'foods' ? 'bg-background' : ''
              }`}>
              <Text
                className={`text-base font-bold ${
                  subTab === 'foods' ? 'text-text font-bold' : 'text-muted'
                }`}>
                음식 도감 ({stats.foods.length})
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`밥 친구 랭킹 ${stats.companions.length}명`}
              onPress={() => setSubTab('companions')}
              className={`flex-1 items-center justify-center rounded-xl py-3 active:opacity-80 ${
                subTab === 'companions' ? 'bg-background' : ''
              }`}>
              <Text
                className={`text-base font-bold ${
                  subTab === 'companions' ? 'text-text font-bold' : 'text-muted'
                }`}>
                밥 친구 랭킹 ({stats.companions.length})
              </Text>
            </Pressable>
          </View>

          {subTab === 'foods' ? (
            stats.foods.length === 0 ? (
              <View className="rounded-3xl bg-surface p-6">
                <Text className="text-lg font-bold text-muted">아직 같이 먹은 기록이 없어요</Text>
              </View>
            ) : (
              <View className="flex-row flex-wrap justify-between gap-y-2">
                {stats.foods.map((f) => (
                  <View
                    key={f.foodId}
                    className="min-h-14 w-[49%] flex-row items-center gap-2 rounded-3xl bg-surface py-2 pl-3 pr-4">
                    <FoodDot foodId={f.foodId} size="sm" />
                    <Text className="flex-1 text-base font-bold text-text">
                      {f.name}
                    </Text>
                    <Text className="text-sm font-semibold text-muted">{f.mealCount}번</Text>
                  </View>
                ))}
              </View>
            )
          ) : stats.companions.length === 0 ? (
            <View className="rounded-3xl bg-surface p-6">
              <Text className="text-lg font-bold text-muted">아직 같이 먹은 밥 친구가 없어요</Text>
            </View>
          ) : (
            <View className="gap-3 rounded-3xl bg-surface p-4">
              {stats.companions.map((c) => (
                <View key={c.userId} className="flex-row items-center gap-3">
                  <View className="h-10 w-10 items-center justify-center rounded-full bg-primary">
                    <Text className="text-xl font-bold text-on-primary">
                      {Array.from(c.displayName)[0] ?? ''}
                    </Text>
                  </View>
                  <Text className="flex-1 text-lg font-bold text-text" numberOfLines={1}>
                    {c.displayName}
                  </Text>
                  <Text className="text-sm font-semibold text-muted">{c.mealCount}번</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* 설정 (명세 4-24). 부품은 settings-list */}
        <SettingsList
          name={stats.profile.displayName ?? ''}
          hasType={!!letters}
          onRestrictions={() => router.push('/restrictions' as any)}
          onOnboarding={toOnboarding}
          onAccount={() => setAccountVisible(true)}
        />
      </ScrollView>
      <AccountSheet visible={accountVisible} onClose={() => setAccountVisible(false)} />
    </SafeAreaView>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View className="flex-1 gap-1 rounded-3xl bg-surface p-4">
      <Text className="text-3xl font-bold tracking-tight text-text">{value}</Text>
      <Text className="text-sm text-muted">{label}</Text>
    </View>
  );
}
