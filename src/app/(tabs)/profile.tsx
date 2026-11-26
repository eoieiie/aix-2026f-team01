import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/text';
import { choiceSurface } from '@/components/choice-colors';
import { FoodDex } from '@/components/food-dex';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AccountSheet } from '@/components/account-sheet';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { CardButton, ProfileSummaryCard } from '@/components/profile-summary-card';
import { SettingsList } from '@/components/settings-list';
import colors from '@/constants/colors.json';
import { TAB_BAR_SPACE } from '@/constants';
import { nextAvatarUnlock } from '@/constants/prefs';
import { useAvatarOptions, useMyPrefs } from '@/hooks/use-prefs';
import { authorityTitle, levelProgress, typeLetters, useMyStats } from '@/hooks/use-stats';

// 내 프로필 탭 (4-15, 4-27, #41). 아바타와 이름, 네 글자, 레벨 막대, 숫자, 먹어본 음식 도감, 같이 먹은 사람, 그리고 설정 줄
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { stats, isLoading, isError, refetch } = useMyStats();
  // 아바타와 취향은 못 받아도 탭은 그대로 보인다
  const { prefs, refetch: refetchPrefs } = useMyPrefs();
  const { options, refetch: refetchOptions } = useAvatarOptions();
  const [accountVisible, setAccountVisible] = useState(false);
  const [subTab, setSubTab] = useState<'foods' | 'companions'>('foods');

  // 못 먹는 것, 온보딩, 프로필 고치기에서 돌아오면 다시 읽는다
  useFocusEffect(
    useCallback(() => {
      refetch();
      refetchPrefs();
      refetchOptions();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={colors.text} accessibilityLabel="프로필을 불러오는 중" />
      </SafeAreaView>
    );
  }

  if (isError || !stats) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-background px-4">
        <Text className="text-lg font-bold text-text">프로필을 불러올 수 없어요</Text>
        <View className="w-full max-w-xs">
          <Button label="다시 시도" variant="secondary" onPress={() => refetch()} />
        </View>
      </SafeAreaView>
    );
  }

  const total = stats.foods.reduce((s, f) => s + f.mealCount, 0);
  const { level, toNext, ratio } = levelProgress(total);
  const next = nextAvatarUnlock(options);
  const letters = stats.profile.axes ? typeLetters(stats.profile.axes, stats.profile.quizAnswers) : null;
  const toOnboarding = () => router.push('/onboarding?from=profile' as any);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets
        contentContainerClassName="gap-8 px-4 pt-3"
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
          progress={ratio}
          avatarFoodId={prefs?.avatarFoodId ?? null}
          nextAvatar={next ? { foodId: next.foodId, name: next.name, unlockLevel: next.unlockLevel } : null}
          onEdit={() => router.push('/profile/edit' as any)}
          action={<CardButton label="내 네 글자 만들기" onPress={toOnboarding} />}
        />

        <View className="flex-row gap-2">
          <Stat value={total} unit="끼" label="총 끼니" />
          <Stat value={stats.foods.length} unit="개" label="음식 도감" />
          <Stat value={stats.companions.length} unit="명" label="밥 친구" />
        </View>

        {/* 기록 탭: 음식 도감과 밥 친구 랭킹을 세그먼트 탭으로 전환 */}
        <View className="gap-3">
          <View className="flex-row rounded-2xl bg-surface p-1">
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: subTab === 'foods' }}
              accessibilityLabel={`음식 도감 ${stats.foods.length}개`}
              onPress={() => setSubTab('foods')}
              style={choiceSurface(subTab === 'foods', 'transparent')}
              className={`flex-1 items-center justify-center min-h-11 rounded-lg py-2 active:opacity-80 ${
                subTab === 'foods' ? 'bg-ink' : ''
              }`}>
              <Text
                className={`text-base font-bold ${
                  subTab === 'foods' ? 'text-on-ink' : 'text-muted'
                }`}>
                음식 도감 ({stats.foods.length})
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: subTab === 'companions' }}
              accessibilityLabel={`밥 친구 랭킹 ${stats.companions.length}명`}
              onPress={() => setSubTab('companions')}
              style={choiceSurface(subTab === 'companions', 'transparent')}
              className={`flex-1 items-center justify-center min-h-11 rounded-lg py-2 active:opacity-80 ${
                subTab === 'companions' ? 'bg-ink' : ''
              }`}>
              <Text
                className={`text-base font-bold ${
                  subTab === 'companions' ? 'text-on-ink' : 'text-muted'
                }`}>
                밥 친구 랭킹 ({stats.companions.length})
              </Text>
            </Pressable>
          </View>

          {subTab === 'foods' ? (
            // 4-25 음식 도감: 그림 카드 모음
            <FoodDex />
          ) : stats.companions.length === 0 ? (
            <View className="rounded-3xl bg-surface p-4">
              <Text className="text-base font-bold text-muted">아직 같이 먹은 밥 친구가 없어요</Text>
            </View>
          ) : (
            // 사람 한 줄: 왼쪽 아바타 44, 안 여백 16 (얇은 칸을 쓰지 않는다)
            <View className="gap-2">
              {stats.companions.map((c) => (
                <View key={c.userId} className="flex-row items-center gap-3 rounded-3xl bg-surface p-4">
                  <Avatar name={c.displayName} userId={c.userId} size={44} />
                  <Text className="flex-1 text-lg font-bold text-text">
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

// 큰 숫자와 단위는 글자 아래 기준선을 맞춘다 (docs/design.md "글자는 역할별로")
function Stat({ value, unit, label }: { value: number; unit: string; label: string }) {
  return (
    <View accessible accessibilityLabel={`${label} ${value}${unit}`} className="flex-1 gap-1 rounded-3xl bg-surface p-4">
      <View className="flex-row items-baseline gap-1">
        <Text className="text-3xl font-bold tracking-tight text-text">{value}</Text>
        <Text className="text-sm font-semibold text-muted">{unit}</Text>
      </View>
      <Text className="text-sm text-muted">{label}</Text>
    </View>
  );
}
