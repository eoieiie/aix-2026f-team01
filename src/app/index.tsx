import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { CreateGroupModal } from '@/components/create-group-modal';
import { Group, useMyGroups } from '@/hooks/use-groups';

export default function HomeScreen() {
  const router = useRouter();
  const { groups, isLoading, isError, error, refetch } = useMyGroups();
  const [modalVisible, setModalVisible] = useState(false);
  const hasGroups = groups.length > 0;

  // 모임 한 줄. 사진이 없으니 모임 이름 첫 글자를 검은 사각형에 크게 쓴다
  const renderGroupItem = ({ item }: { item: Group }) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.name} 모임 열기`}
      className="flex-row items-center gap-4 rounded-3xl bg-surface p-4 active:opacity-80"
      onPress={() => router.push(`/groups/${item.id}`)}
    >
      <View className="h-14 w-14 items-center justify-center rounded-2xl bg-text">
        <Text className="text-2xl font-extrabold text-on-primary">
          {Array.from(item.name)[0] ?? ''}
        </Text>
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="text-lg font-bold text-text" numberOfLines={1}>
          {item.name}
        </Text>
        <Text className="text-sm text-muted">초대 코드 {item.invite_code}</Text>
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-5 pt-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-base font-extrabold text-text">밥비티아이</Text>
          {/* 모임이 없을 때는 아래 "첫 모임 만들기"가 강조 버튼이라 위쪽은 회색으로 둔다 (spec.md 7절 강조 신호 하나) */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="모임 만들기"
            className={`rounded-full px-4 py-2.5 active:opacity-80 ${
              hasGroups ? 'bg-primary' : 'bg-surface'
            }`}
            onPress={() => setModalVisible(true)}
          >
            <Text className={`text-sm font-bold ${hasGroups ? 'text-on-primary' : 'text-text'}`}>
              모임 만들기
            </Text>
          </Pressable>
        </View>

        <View className="mb-6 mt-8 gap-2">
          <Text className="text-4xl font-extrabold leading-tight tracking-tight text-text">
            {'오늘은\n누구랑 먹어요?'}
          </Text>
          <Text className="text-base text-muted">모임을 고르면 같이 메뉴를 정할 수 있어요</Text>
        </View>

        {isLoading ? (
          <Text className="text-sm text-muted">모임을 불러오는 중</Text>
        ) : isError ? (
          // 오류 상태: 오류 문구와 다시 시도 버튼 (spec.md 4-3)
          <View className="gap-3">
            <Text className="text-base font-bold text-text">모임을 불러올 수 없어요</Text>
            <Text className="text-sm text-muted">
              {error?.message || '인터넷 연결을 확인하고 다시 시도해 주세요'}
            </Text>
            <Button label="다시 시도" variant="secondary" onPress={() => refetch()} />
          </View>
        ) : !hasGroups ? (
          // 모임이 없을 때: "아직 모임이 없어요"와 만들기 버튼 (spec.md 4-3)
          <View className="gap-4 rounded-3xl bg-surface p-6">
            <View className="gap-1">
              <Text className="text-lg font-bold text-text">아직 모임이 없어요</Text>
              <Text className="text-sm text-muted">
                모임을 만들고 초대 링크를 보내면 친구가 바로 들어와요
              </Text>
            </View>
            <Button label="첫 모임 만들기" onPress={() => setModalVisible(true)} />
          </View>
        ) : (
          // 최근에 들어간 순으로 보이는 모임 목록 (spec.md 4-3)
          <FlatList
            data={groups}
            keyExtractor={(item) => item.id}
            renderItem={renderGroupItem}
            ItemSeparatorComponent={() => <View className="h-3" />}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 24 }}
          />
        )}
      </View>

      <CreateGroupModal visible={modalVisible} onClose={() => setModalVisible(false)} />
    </SafeAreaView>
  );
}
