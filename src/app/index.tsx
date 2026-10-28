import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CreateGroupModal } from '@/components/create-group-modal';
import { Group, useMyGroups } from '@/hooks/use-groups';

export default function HomeScreen() {
  const router = useRouter();
  const { groups, isLoading, isError, error, refetch } = useMyGroups();
  const [modalVisible, setModalVisible] = useState(false);

  const renderGroupItem = ({ item }: { item: Group }) => (
    <Pressable
      className="mb-3 rounded-2xl bg-surface p-5 active:opacity-80"
      onPress={() => router.push(`/groups/${item.id}`)}
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-bold text-text">{item.name}</Text>
        <Text className="font-mono text-xs font-semibold text-muted">
          코드 {item.invite_code}
        </Text>
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-5 pt-4">
        {/* 헤더 */}
        <View className="mb-6 flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-text">밥비티아이</Text>
            <Text className="mt-0.5 text-xs text-muted">오늘 뭐 먹을지 함께 정해요</Text>
          </View>
          <Pressable
            className="rounded-xl bg-primary px-4 py-2.5 active:opacity-90"
            onPress={() => setModalVisible(true)}
          >
            <Text className="text-xs font-bold text-on-primary">모임 만들기</Text>
          </Pressable>
        </View>

        {/* 본문 영역 */}
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-sm text-muted">모임을 불러오는 중...</Text>
          </View>
        ) : isError ? (
          // 오류 상태: 오류 문구와 다시 시도 버튼 (spec.md 4-3)
          <View className="flex-1 items-center justify-center">
            <Text className="text-base font-semibold text-text">
              모임을 불러올 수 없어요
            </Text>
            <Text className="mt-1 text-xs text-muted">
              {error?.message || '네트워크 상태를 확인해주세요.'}
            </Text>
            <Pressable
              className="mt-4 rounded-xl bg-surface px-5 py-2.5 active:opacity-80"
              onPress={() => refetch()}
            >
              <Text className="text-xs font-bold text-text">다시 시도</Text>
            </Pressable>
          </View>
        ) : groups.length === 0 ? (
          // 모임이 없을 때: "아직 모임이 없어요"와 만들기 버튼 (spec.md 4-3)
          <View className="flex-1 items-center justify-center px-4">
            <View className="w-full max-w-xs items-center rounded-2xl bg-surface p-8">
              <Text className="text-base font-bold text-text">아직 모임이 없어요</Text>
              <Text className="mt-1 text-center text-xs text-muted">
                새 모임을 만들고 친구들을 초대해보세요.
              </Text>
              <Pressable
                className="mt-5 w-full items-center rounded-xl bg-primary py-3 active:opacity-90"
                onPress={() => setModalVisible(true)}
              >
                <Text className="text-sm font-bold text-on-primary">첫 모임 만들기</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          // 최근에 들어간 순으로 보이는 모임 목록 (spec.md 4-3)
          <FlatList
            data={groups}
            keyExtractor={(item) => item.id}
            renderItem={renderGroupItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 24 }}
          />
        )}
      </View>

      {/* 모임 만들기 모달 */}
      <CreateGroupModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
      />
    </SafeAreaView>
  );
}
