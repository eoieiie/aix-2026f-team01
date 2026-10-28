import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { InviteCard } from '@/components/invite-card';
import { Member, RecentMeal, useGroupDetail } from '@/hooks/use-groups';

export default function GroupScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { group, isLoading, isError, error, refetch } = useGroupDetail(id || '');

  // 로딩 상태
  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <Text className="text-sm text-muted">모임 정보를 불러오는 중...</Text>
      </SafeAreaView>
    );
  }

  // 오류 상태
  if (isError) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background px-6">
        <Text className="text-base font-bold text-text">모임 정보를 불러올 수 없어요</Text>
        <Text className="mt-1 text-xs text-muted">
          {error?.message || '네트워크 상태를 확인해주세요.'}
        </Text>
        <Pressable
          className="mt-4 rounded-xl bg-surface px-5 py-2.5 active:opacity-80"
          onPress={() => refetch()}
        >
          <Text className="text-xs font-bold text-text">다시 시도</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // 소속이 아닌 경우: "이 모임 멤버가 아니에요"와 홈으로 버튼 (spec.md 4-6)
  if (!group || !group.is_member) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background px-6">
        <View className="w-full max-w-xs items-center rounded-2xl bg-surface p-8">
          <Text className="text-base font-bold text-text">이 모임 멤버가 아니에요</Text>
          <Text className="mt-1 text-center text-xs text-muted">
            초대 링크를 통해 참여하거나 홈으로 돌아가세요.
          </Text>
          <Pressable
            className="mt-5 w-full items-center rounded-xl bg-primary py-3 active:opacity-90"
            onPress={() => router.replace('/')}
          >
            <Text className="text-sm font-bold text-on-primary">홈으로</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const hasOpenSession = !!group.open_session_id;

  const handleStartOrJoinSession = () => {
    // E 담당자 연결 자리 (spec.md 10절 C: "오늘 뭐 먹지" 버튼 자리(E가 연결))
    if (hasOpenSession) {
      router.push(`/sessions/${group.open_session_id}` as any);
    } else {
      // 진행 중인 세션이 없을 때 시작 (E에서 세션 생성 및 이동 로직 연결)
      router.push(`/sessions/new?groupId=${group.id}` as any);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* 상단 네비게이션 */}
      <View className="flex-row items-center justify-between px-5 py-3">
        <Pressable
          className="rounded-xl bg-surface px-3.5 py-2 active:opacity-80"
          onPress={() => router.back()}
        >
          <Text className="text-xs font-semibold text-text">뒤로</Text>
        </Pressable>
        <Text className="text-base font-bold text-text">{group.name}</Text>
        <View className="w-12" />
      </View>

      <ScrollView
        className="flex-1 px-5"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* 초대 카드 (spec.md 4-4) */}
        <View className="mt-3">
          <InviteCard inviteCode={group.invite_code} />
        </View>

        {/* 멤버 목록 (spec.md 4-6: 멤버 이름 동그라미) */}
        <View className="mt-6">
          <Text className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
            참여 멤버 ({group.members.length}명)
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
            {group.members.map((member: Member) => {
              const initial = member.display_name.charAt(0) || '?';
              return (
                <View key={member.user_id} className="mr-3 items-center">
                  <View className="h-12 w-12 items-center justify-center rounded-full bg-surface">
                    <Text className="text-base font-bold text-text">{initial}</Text>
                  </View>
                  <Text className="mt-1 text-xs text-text" numberOfLines={1}>
                    {member.display_name}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        </View>

        {/* 최근 식사 5개 (spec.md 4-6) */}
        <View className="mt-6">
          <Text className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
            최근 식사
          </Text>
          {group.recent_meals.length === 0 ? (
            <View className="rounded-2xl bg-surface p-5">
              <Text className="text-center text-xs text-muted">아직 함께한 식사 기록이 없어요.</Text>
            </View>
          ) : (
            <View className="gap-2">
              {group.recent_meals.map((meal: RecentMeal) => (
                <View
                  key={meal.id}
                  className="flex-row items-center justify-between rounded-xl bg-surface p-4"
                >
                  <Text className="text-sm font-semibold text-text">{meal.food_name}</Text>
                  <Text className="text-xs text-muted">
                    {new Date(meal.eaten_at).toLocaleDateString('ko-KR', {
                      month: 'long',
                      day: 'numeric',
                    })}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* 하단 고정 버튼 영역 */}
      <View className="absolute bottom-0 left-0 right-0 bg-background/95 px-5 pb-8 pt-3">
        <Pressable
          className="w-full items-center justify-center rounded-2xl bg-primary py-4 active:opacity-90"
          onPress={handleStartOrJoinSession}
        >
          {/* 진행 중인 판 유무에 따른 버튼 문구 분기 (spec.md 4-6) */}
          <Text className="text-base font-bold text-on-primary">
            {hasOpenSession ? '진행 중인 판으로' : '오늘 뭐 먹지'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
