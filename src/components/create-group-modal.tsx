import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';

import { DISPLAY_NAME_MAX, GROUP_NAME_MAX } from '@/constants';
import { useCreateGroup } from '@/hooks/use-groups';

interface CreateGroupModalProps {
  visible: boolean;
  onClose: () => void;
}

export function CreateGroupModal({ visible, onClose }: CreateGroupModalProps) {
  const router = useRouter();
  const { createGroup, isPending, error, reset } = useCreateGroup();

  const [groupName, setGroupName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const trimmedGroupName = groupName.trim();
  const trimmedDisplayName = displayName.trim();

  // 빈 이름이면 버튼 비활성화 (spec.md 4-2)
  const isFormValid =
    trimmedGroupName.length >= 1 &&
    trimmedGroupName.length <= GROUP_NAME_MAX &&
    trimmedDisplayName.length >= 1 &&
    trimmedDisplayName.length <= DISPLAY_NAME_MAX;

  const handleClose = () => {
    setGroupName('');
    setDisplayName('');
    setLocalError(null);
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!isFormValid || isPending) return;

    try {
      setLocalError(null);
      const result = await createGroup({
        name: trimmedGroupName,
        displayName: trimmedDisplayName,
      });
      handleClose();
      // 생성된 모임 화면으로 이동
      router.push(`/groups/${result.group_id}`);
    } catch (err: unknown) {
      // 서버 오류는 창 안에 한국어 문구로 보여주고 창을 닫지 않는다 (spec.md 4-2)
      if (err instanceof Error) {
        setLocalError(err.message);
      } else {
        setLocalError('모임을 만들지 못했어요. 다시 시도해주세요.');
      }
    }
  };

  const displayErrorMessage = localError || (error ? (error as Error).message : null);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View className="flex-1 items-center justify-center bg-black/40 px-6">
        <View className="w-full max-w-sm rounded-3xl bg-background p-6">
          <Text className="text-2xl font-extrabold text-text">새 모임 만들기</Text>
          <Text className="mt-1 text-sm text-muted">모임 이름과 내 이름을 입력해주세요.</Text>

          <View className="mt-5 gap-4">
            <View>
              <Text className="mb-1 text-xs font-medium text-muted">
                모임 이름 ({trimmedGroupName.length}/{GROUP_NAME_MAX})
              </Text>
              <TextInput
                className="h-12 rounded-xl bg-surface px-4 text-base text-text placeholder:text-muted"
                placeholder="예: 점심 팟"
                value={groupName}
                onChangeText={(text) => {
                  setGroupName(text);
                  setLocalError(null);
                }}
                maxLength={GROUP_NAME_MAX}
                autoFocus
              />
            </View>

            <View>
              <Text className="mb-1 text-xs font-medium text-muted">
                내 이름 ({trimmedDisplayName.length}/{DISPLAY_NAME_MAX})
              </Text>
              <TextInput
                className="h-12 rounded-xl bg-surface px-4 text-base text-text placeholder:text-muted"
                placeholder="예: 홍길동"
                value={displayName}
                onChangeText={(text) => {
                  setDisplayName(text);
                  setLocalError(null);
                }}
                maxLength={DISPLAY_NAME_MAX}
              />
            </View>
          </View>

          {/* 오류 문구 표시 (창을 닫지 않음) */}
          {displayErrorMessage ? (
            <View className="mt-3 rounded-lg bg-surface p-2">
              <Text className="text-center text-xs text-danger">{displayErrorMessage}</Text>
            </View>
          ) : null}

          <View className="mt-6 flex-row gap-2">
            <Pressable
              className="flex-1 items-center justify-center rounded-full bg-surface py-4"
              onPress={handleClose}
              disabled={isPending}
            >
              <Text className="text-sm font-semibold text-text">취소</Text>
            </Pressable>

            <Pressable
              className={`flex-1 items-center justify-center rounded-full py-4 ${
                isFormValid && !isPending ? 'bg-primary' : 'bg-surface opacity-50'
              }`}
              onPress={handleSubmit}
              disabled={!isFormValid || isPending}
            >
              <Text
                className={`text-sm font-semibold ${
                  isFormValid && !isPending ? 'text-on-primary' : 'text-muted'
                }`}
              >
                {isPending ? '만드는 중...' : '만들기'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
