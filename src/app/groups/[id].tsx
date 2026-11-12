import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { FoodDot } from '@/components/food-dot';
import { GroupProfileCard } from '@/components/group-profile-card';
import { HeadcountModal } from '@/components/headcount-modal';
import { IconButton } from '@/components/icon';
import { InviteCard } from '@/components/invite-card';
import colors from '@/constants/colors.json';
import { HEADCOUNT_MAX } from '@/constants';
import {
  Member,
  RecentMeal,
  useGroupDetail,
  useStartSession,
} from '@/hooks/use-groups';

// 멤버 동그라미 색. 홈 모임 카드의 사람 동그라미와 같은 순서 (docs/design.md 1절)
const MEMBER_COLORS = [
  { bg: 'bg-food-8', text: 'text-on-ink' },
  { bg: 'bg-food-2', text: 'text-on-ink' },
  { bg: 'bg-food-4', text: 'text-text' },
] as const;

export default function GroupScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { group, isLoading, isError, refetch } = useGroupDetail(id || '');
  const { startSession, isPending: isStartingSession } = useStartSession(id || '');
  const [askHeadcount, setAskHeadcount] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  // 로딩 상태
  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={colors.primary} accessibilityLabel="모임을 불러오는 중" />
      </SafeAreaView>
    );
  }

  // 오류 상태: 한국어 문구와 다시 시도. 판 화면의 오류 상태와 같은 모양 (spec.md 4절 실패할 때)
  if (isError) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-background px-6">
        <Text className="text-lg font-bold text-text">모임 정보를 불러올 수 없어요</Text>
        <View className="w-full max-w-xs">
          <Button label="다시 시도" variant="secondary" onPress={() => refetch()} />
        </View>
      </SafeAreaView>
    );
  }

  // 소속이 아닌 경우: "이 모임 멤버가 아니에요"와 홈으로 버튼 (spec.md 4-6)
  if (!group || !group.is_member) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-background px-6">
        <Text className="text-lg font-bold text-text">이 모임 멤버가 아니에요</Text>
        <View className="w-full max-w-xs">
          <Button label="홈으로" onPress={() => router.replace('/')} />
        </View>
      </SafeAreaView>
    );
  }

  const hasOpenSession = !!group.open_session_id;

  // 진행 중인 판이 있으면 그 판으로, 없으면 먼저 몇 명이서 먹는지 묻는다 (4-6)
  const handleStartOrJoinSession = async (expectedCount?: number) => {
    if (isStartingSession) return;
    if (!hasOpenSession && expectedCount === undefined) {
      setStartError(null);
      setAskHeadcount(true);
      return;
    }
    try {
      // 진행 중인 판이 있으면 그 판 id, 없으면 새로 만든 판 id를 서버가 돌려준다 (spec.md 4-6, 4-8)
      const sessionId = await startSession(expectedCount);
      setAskHeadcount(false);
      router.push(`/sessions/${sessionId}` as any);
    } catch (err: unknown) {
      if (group.open_session_id) {
        setAskHeadcount(false);
        router.push(`/sessions/${group.open_session_id}` as any);
      } else {
        setStartError(err instanceof Error ? err.message : '판을 열지 못했어요');
      }
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center px-5 py-3">
        <IconButton name="back" label="홈으로" onPress={() => router.replace('/')} />
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="gap-8 px-5 pb-36 pt-2"
      >
        {/* 모임 이름과 멤버 이름 동그라미 (spec.md 4-6) */}
        <View className="gap-4">
          <Text className="text-4xl font-extrabold leading-tight tracking-tight text-text">
            {group.name}
          </Text>
          <View className="flex-row flex-wrap items-center gap-3">
            {group.members.map((member: Member, i: number) => {
              const color = MEMBER_COLORS[i % MEMBER_COLORS.length];
              return (
                <View key={member.user_id} className="items-center gap-2">
                  <View
                    className={`h-14 w-14 items-center justify-center rounded-full ${color.bg}`}>
                    <Text className={`text-lg font-extrabold ${color.text}`}>
                      {Array.from(member.display_name)[0] ?? ''}
                    </Text>
                  </View>
                  <Text className="max-w-16 text-sm font-semibold text-text" numberOfLines={1}>
                    {member.display_name}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* 초대 카드 (spec.md 4-4) */}
        <InviteCard inviteCode={group.invite_code} groupName={group.name} />

        {/* 최근 식사 5개 (spec.md 4-6) */}
        <View className="gap-3">
          <Text className="text-2xl font-extrabold tracking-tight text-text">최근에 먹은 것</Text>
          {group.recent_meals.length === 0 ? (
            <View className="rounded-3xl bg-surface p-6">
              <Text className="text-lg font-extrabold text-muted">아직 기록이 없어요</Text>
            </View>
          ) : (
            <View className="gap-4 rounded-3xl bg-surface p-5">
              {group.recent_meals.map((meal: RecentMeal) => (
                // 한 줄을 누르면 그 식사의 결과 카드 (4-17)
                <Pressable
                  key={meal.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${meal.food_name} 결과 카드`}
                  onPress={() => router.push(`/meals/${meal.id}` as any)}
                  className="min-h-11 flex-row items-center gap-3 active:opacity-70">
                  <FoodDot foodId={meal.food_id} size="md" name={meal.food_name} />
                  <Text className="flex-1 text-lg font-extrabold text-text">{meal.food_name}</Text>
                  <Text className="text-sm text-muted">
                    {new Date(meal.eaten_at).toLocaleDateString('ko-KR', {
                      month: 'long',
                      day: 'numeric',
                    })}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* 모임 프로필 카드 (spec.md 4-16). 실패하면 카드 자리에만 문구가 나온다 */}
        <GroupProfileCard groupId={group.id} />
      </ScrollView>

      {/* 하단 고정 버튼. 진행 중인 판이 있으면 "진행 중인 판으로" (spec.md 4-6) */}
      <View className="absolute bottom-0 left-0 right-0 bg-background px-5 pb-8 pt-3">
        <Button
          label={hasOpenSession ? '진행 중인 판으로' : '오늘 뭐 먹지'}
          onPress={() => handleStartOrJoinSession()}
          loading={isStartingSession && !askHeadcount}
        />
      </View>

      {askHeadcount ? (
        <HeadcountModal
          visible
          initial={Math.min(HEADCOUNT_MAX, Math.max(2, group.members.length))}
          loading={isStartingSession}
          error={startError}
          onClose={() => setAskHeadcount(false)}
          onStart={(count) => handleStartOrJoinSession(count)}
        />
      ) : null}
    </SafeAreaView>
  );
}
