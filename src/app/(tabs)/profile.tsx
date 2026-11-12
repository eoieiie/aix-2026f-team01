import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccountSheet } from '@/components/account-sheet';
import { Button } from '@/components/button';
import { FoodDot } from '@/components/food-dot';
import { Icon, type IconName } from '@/components/icon';
import { ProfileSummaryCard } from '@/components/profile-summary-card';
import colors from '@/constants/colors.json';
import { TAB_BAR_SPACE } from '@/constants';
import { authorityTitle, levelOf, typeLetters, useMyStats } from '@/hooks/use-stats';

// 내 프로필 탭 (4-15, #41). 네 글자, 레벨과 숫자, 먹어본 음식 도감, 같이 먹은 사람, 그리고 설정 줄
export default function ProfileScreen() {
  const router = useRouter();
  const { stats, isLoading, isError, refetch } = useMyStats();
  const [accountVisible, setAccountVisible] = useState(false);

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
  const letters = stats.profile.axes ? typeLetters(stats.profile.axes) : null;
  const toOnboarding = () => router.push('/onboarding?from=profile' as any);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView
        contentContainerClassName="gap-8 px-5 pt-3"
        contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE }}
        showsVerticalScrollIndicator={false}>
        <View className="h-12 justify-center">
          <Text className="text-3xl font-extrabold tracking-tight text-text">내 프로필</Text>
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
          <Stat value={stats.foods.length} label="먹어본 음식" />
          <Stat value={stats.companions.length} label="같이 먹은 사람" />
        </View>

        <View className="gap-3">
          <Text className="text-2xl font-extrabold tracking-tight text-text">먹어본 음식</Text>
          {stats.foods.length === 0 ? (
            <View className="rounded-3xl bg-surface p-6">
              <Text className="text-lg font-extrabold text-muted">아직 같이 먹은 기록이 없어요</Text>
            </View>
          ) : (
            <View className="flex-row flex-wrap justify-between gap-y-2">
              {stats.foods.map((f) => (
                <View
                  key={f.foodId}
                  className="h-14 w-[49%] flex-row items-center gap-2 rounded-full bg-surface pl-3 pr-4">
                  <FoodDot foodId={f.foodId} size="sm" />
                  <Text className="flex-1 text-base font-bold text-text" numberOfLines={1}>
                    {f.name}
                  </Text>
                  <Text className="text-sm font-semibold text-muted">{f.mealCount}번</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {stats.companions.length > 0 ? (
          <View className="gap-3">
            <Text className="text-2xl font-extrabold tracking-tight text-text">같이 먹은 사람</Text>
            <View className="gap-4 rounded-3xl bg-surface p-5">
              {stats.companions.map((c) => (
                <View key={c.userId} className="flex-row items-center gap-3">
                  <View className="h-10 w-10 items-center justify-center rounded-full bg-food-8">
                    <Text className="text-base font-extrabold text-on-ink">
                      {Array.from(c.displayName)[0] ?? ''}
                    </Text>
                  </View>
                  <Text className="flex-1 text-lg font-extrabold text-text" numberOfLines={1}>
                    {c.displayName}
                  </Text>
                  <Text className="text-sm text-muted">{c.mealCount}번</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View className="gap-2">
          <Row icon="close" label="못 먹는 것" onPress={() => router.push('/restrictions' as any)} />
          {letters ? <Row icon="pencil" label="네 글자 다시 만들기" onPress={toOnboarding} /> : null}
          <Row icon="person" label="아이디로 이어 쓰기" onPress={() => setAccountVisible(true)} />
        </View>
      </ScrollView>
      <AccountSheet visible={accountVisible} onClose={() => setAccountVisible(false)} />
    </SafeAreaView>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View className="flex-1 gap-1 rounded-3xl bg-surface p-4">
      <Text className="text-3xl font-extrabold tracking-tight text-text">{value}</Text>
      <Text className="text-sm text-muted">{label}</Text>
    </View>
  );
}

// 설정 줄. 같은 높이 56, 왼쪽 아이콘, 오른쪽 화살표 없이 (docs/design.md 4절)
function Row({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="h-14 flex-row items-center gap-3 rounded-full bg-surface px-5 active:opacity-70">
      <Icon name={icon} size={20} />
      <Text className="text-base font-bold text-text">{label}</Text>
    </Pressable>
  );
}
