import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Image, Pressable, View } from 'react-native';
import { Text } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { CreateGroupModal } from '@/components/create-group-modal';
import { FoodThumb } from '@/components/food-thumb';
import { IconButton } from '@/components/icon';
import { Logo } from '@/components/logo';
import { HeroBand, mealGreeting } from '@/components/hero-band';
import { PersonDots } from '@/components/person-dots';
import { PlateFoods } from '@/components/plate-foods';
import { Group, useMyGroups, useMyGroupsLive } from '@/hooks/use-groups';
import { TAB_BAR_SPACE } from '@/constants';

const mascotSource = require('../../../assets/images/mascot.png');

export default function HomeScreen() {
  const router = useRouter();
  const { groups, isLoading, isError, refetch } = useMyGroups();
  // 다른 사람이 판을 열면 "판 진행 중"이 바로 붙는다
  useMyGroupsLive();
  const [modalVisible, setModalVisible] = useState(false);
  const hasGroups = groups.length > 0;

  // 모임 카드 (docs/design.md "떠 있는 아래 탭과 박스, 글자 정돈", 2026-11-26). 그림이 크면 글을 읽기 전에 어느 모임인지 알아본다.
  // 왼쪽에 큰 동그라미 그림 72(마지막으로 같이 먹은 음식, 없으면 마스코트), 굵은 모임 이름과 옆에 인원 칩,
  // 회색 한 줄(최근 먹은 메뉴들), 진행 중인 판이 있으면 옅은 주황 칩 "판 진행 중"(이 화면의 주황은 이것뿐),
  // 아래 줄 왼쪽에 작은 사람 동그라미, 오른쪽에 그 전에 먹은 음식 원 줄(왼쪽 그림과 같은 음식은 빼서 겹치지 않게)
  const renderGroupItem = ({ item }: { item: Group }) => {
    const latest = item.recent_foods[0];
    const earlier = latest ? item.plate_foods.filter((food) => food.food_id !== latest.food_id) : [];
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.name} 모임 열기`}
        className="flex-row items-center gap-4 rounded-3xl bg-surface p-4 active:opacity-80"
        onPress={() => router.push(`/groups/${item.id}`)}
      >
        {latest ? (
          <FoodThumb foodId={latest.food_id} size="lg" />
        ) : (
          // 아직 먹은 기록이 없는 모임은 마스코트를 그림 자리에 둔다
          <View className="h-[72px] w-[72px] items-center justify-center rounded-full bg-background">
            <Image source={mascotSource} style={{ width: 40, height: 30 }} resizeMode="contain" />
          </View>
        )}
        <View className="flex-1 gap-2">
          <View className="gap-1">
            <View className="flex-row flex-wrap items-center gap-2">
              <Text className="text-lg font-bold tracking-tight text-text">{item.name}</Text>
              <View className="rounded-full bg-background px-2 py-0.5">
                <Text className="text-xs font-semibold text-muted">{item.members.length}명</Text>
              </View>
            </View>
            <Text className="text-sm text-muted">
              {item.recent_foods.length > 0
                ? item.recent_foods.map((food) => food.food_name).join(', ')
                : '아직 같이 먹은 기록이 없어요'}
            </Text>
          </View>
          {item.has_open_session ? (
            <View className="self-start rounded-full bg-primary-soft px-3 py-1">
              <Text className="text-xs font-semibold text-on-primary-soft">판 진행 중</Text>
            </View>
          ) : null}
          <View className="flex-row items-center justify-between gap-2">
            <PersonDots names={item.members} />
            {item.plate_foods.length === 0 ? (
              <PlateFoods foods={[]} />
            ) : earlier.length > 0 ? (
              <PlateFoods foods={earlier} />
            ) : null}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-4 pt-3">
        {/* 로고와 + 버튼은 높이 48 한 줄에서 세로 가운데. 로고 왼쪽 선은 아래 제목과 같다 */}
        <View className="h-12 flex-row items-center justify-between">
          <Logo />
          {/* 오른쪽은 모임 만들기, 모임이 있을 때만. 계정(4-19)은 프로필 탭으로 옮겼다 (#41).
              모임이 없을 때는 아래 카드의 "첫 모임 만들기" 하나만 둔다 (docs/design.md 4절) */}
          {hasGroups ? (
            <IconButton name="plus" label="모임 만들기" onPress={() => setModalVisible(true)} />
          ) : null}
        </View>

        {/* 위쪽 줄과 제목 사이 24, 제목과 목록 사이 24 (docs/design.md 4절). 아래 설명 줄은 두지 않는다 */}
        {/* 시안 다: 제목을 옅은 주황 머리 칸에 넣고 인사 한 줄과 마스코트를 붙인다 */}
        <View className="mb-6 mt-4">
          <HeroBand greeting={mealGreeting()} title="오늘은 누구랑 먹어요?" />
        </View>

        {isLoading ? (
          <Text className="text-sm text-muted">모임을 불러오는 중</Text>
        ) : isError ? (
          // 오류 상태: 오류 문구와 다시 시도 버튼 (spec.md 4-3)
          <View className="gap-3">
            <Text className="text-base font-semibold text-text">모임을 불러올 수 없어요</Text>
            <Text className="text-sm text-muted">
              {/* 오류 원문(영어)은 보이지 않고 한국어 문구만 (spec.md 4절 실패할 때) */}
              인터넷 연결을 확인하고 다시 시도해 주세요
            </Text>
            <Button label="다시 시도" variant="secondary" onPress={() => refetch()} />
          </View>
        ) : !hasGroups ? (
          // 모임이 없을 때: 마스코트, "아직 모임이 없어요"(spec.md 4-3), 글 길이에 맞춘 가운데 버튼 (PR #52)
          <View className="items-center gap-4 rounded-3xl bg-surface p-6">
            <Image
              source={mascotSource}
              style={{ width: 64, height: 49 }}
              resizeMode="contain"
              accessibilityLabel="밥BTI 마스코트"
            />
            <Text className="text-xl font-bold tracking-tight text-text">아직 모임이 없어요</Text>
            <Button
              label="첫 모임 만들기"
              className="self-center px-8"
              onPress={() => setModalVisible(true)}
            />
            {/* 처음 온 사람이 무엇을 하는 앱인지 볼 곳. 모임이 생기면 이 화면과 함께 사라진다 */}
            <Pressable
              accessibilityRole="link"
              className="h-11 justify-center px-4 active:opacity-80"
              onPress={() => router.push('/about')}>
              <Text className="text-sm text-muted">어떻게 하나요</Text>
            </Pressable>
          </View>
        ) : (
          // 최근에 들어간 순으로 보이는 모임 목록 (spec.md 4-3)
          <FlatList
            data={groups}
            keyExtractor={(item) => item.id}
            renderItem={renderGroupItem}
            ItemSeparatorComponent={() => <View className="h-3" />}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE }}
          />
        )}
      </View>

      <CreateGroupModal visible={modalVisible} onClose={() => setModalVisible(false)} />
    </SafeAreaView>
  );
}
