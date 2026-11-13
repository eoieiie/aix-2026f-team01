import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { CreateGroupModal } from '@/components/create-group-modal';
import { FoodDot } from '@/components/food-dot';
import { IconButton } from '@/components/icon';
import { Logo } from '@/components/logo';
import { PersonDots } from '@/components/person-dots';
import { Group, useMyGroups } from '@/hooks/use-groups';
import { TAB_BAR_SPACE } from '@/constants';

const mascotSource = require('../../../assets/images/mascot.png');

export default function HomeScreen() {
  const router = useRouter();
  const { groups, isLoading, isError, refetch } = useMyGroups();
  const [modalVisible, setModalVisible] = useState(false);
  const hasGroups = groups.length > 0;

  // 모임 카드: 사람 동그라미, 모임 이름, 최근 먹은 것. 진행 중인 판이 있으면 주황 알약 하나 (docs/design.md 1절)
  const renderGroupItem = (item: Group) => (
    <Pressable
      key={item.id}
      accessibilityRole="button"
      accessibilityLabel={`${item.name} 모임 열기`}
      className="gap-4 rounded-3xl bg-surface p-5 active:opacity-80"
      onPress={() => router.push(`/groups/${item.id}`)}
    >
      <View className="flex-row items-center justify-between">
        <PersonDots names={item.members} ringClass="border-surface" />
        {item.has_open_session ? (
          <View className="rounded-full bg-primary px-4 py-2">
            <Text className="text-sm font-bold text-on-primary">판 진행 중</Text>
          </View>
        ) : null}
      </View>
      <View className="gap-2">
        <Text className="text-2xl font-extrabold tracking-tight text-text" numberOfLines={1}>
          {item.name}
        </Text>
        {item.recent_foods.length > 0 ? (
          <View className="flex-row flex-wrap items-center gap-x-4 gap-y-1">
            {item.recent_foods.map((food, i) => (
              <View key={`${i}-${food.food_id}`} className="flex-row items-center gap-2">
                <FoodDot foodId={food.food_id} size="xs" />
                <Text className="text-sm font-semibold text-text">{food.food_name}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text className="text-sm text-muted">아직 같이 먹은 기록이 없어요</Text>
        )}
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pt-3"
        contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE }}
        showsVerticalScrollIndicator={false}
      >
        {/* 상단 헤더: 로고 첫 글자와 좌측 선 일치 */}
        <View className="h-14 flex-row items-center justify-between">
          <Logo />
          {hasGroups ? (
            <IconButton name="plus" label="모임 만들기" onPress={() => setModalVisible(true)} />
          ) : null}
        </View>

        {/* 화면 제목: 흰 바탕 위 시원하고 굵은 헤드라인 */}
        <Text className="mb-6 mt-8 text-3xl font-extrabold tracking-tight text-text">
          오늘은 누구랑 먹어요?
        </Text>

        {isLoading ? (
          <Text className="text-sm text-muted">모임을 불러오는 중</Text>
        ) : isError ? (
          <View className="gap-3 rounded-2xl bg-surface p-5">
            <Text className="text-base font-bold text-text">모임을 불러올 수 없어요</Text>
            <Text className="text-sm text-muted">
              인터넷 연결을 확인하고 다시 시도해 주세요
            </Text>
            <Button label="다시 시도" variant="secondary" onPress={() => refetch()} />
          </View>
        ) : !hasGroups ? (
          <View className="items-center gap-4 rounded-3xl bg-surface p-6">
            <Image
              source={mascotSource}
              style={{ width: 88, height: 68 }}
              resizeMode="contain"
              accessibilityLabel="밥BTI 마스코트"
            />
            <Text className="text-xl font-extrabold tracking-tight text-text">아직 모임이 없어요</Text>
            <Button
              label="첫 모임 만들기"
              className="self-center px-8"
              onPress={() => setModalVisible(true)}
            />
          </View>
        ) : (
          <View className="gap-3">
            {groups.map((group) => renderGroupItem(group))}
          </View>
        )}

        {/* 모임 목록 아래: 마스코트의 생각풍선 스토리텔링 영역 */}
        {hasGroups ? (
          <View className="mt-5 items-center gap-1.5 pb-8">
            {/* 회색 모임 카드와 자연스럽게 연결되는 생각 방울 */}
            <View className="h-4 w-4 rounded-full bg-surface-strong" />
            <View className="h-2.5 w-2.5 rounded-full bg-surface-strong" />
            <View className="h-1.5 w-1.5 rounded-full bg-surface-strong" />

            {/* 생각에 잠긴 밥BTI 마스코트 (기존 125x95에서 1.5배 키운 188x143) */}
            <Image
              source={mascotSource}
              style={{ width: 188, height: 143 }}
              resizeMode="contain"
              accessibilityLabel="생각하는 밥BTI 마스코트"
            />

            {/* 마스코트 아래 대사 말풍선 */}
            <View className="mt-1 rounded-2xl bg-surface px-5 py-2">
              <Text className="text-sm font-bold tracking-tight text-text">
                제가 기억하는 모임은 여기까지예요!
              </Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <CreateGroupModal visible={modalVisible} onClose={() => setModalVisible(false)} />
    </SafeAreaView>
  );
}
