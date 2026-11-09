import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';

import { DISPLAY_NAME_MAX, GROUP_NAME_MAX } from '@/constants';
import { useCreateGroup, useMyProfileName } from '@/hooks/use-groups';
import { withRo } from '@/hooks/use-invite';

interface CreateGroupModalProps {
  visible: boolean;
  onClose: () => void;
}

export function CreateGroupModal({ visible, onClose }: CreateGroupModalProps) {
  const router = useRouter();
  const { createGroup, isPending, error, reset } = useCreateGroup();
  // 프로필에 이름이 있으면 내 이름은 묻지 않는다. 서버가 프로필 이름으로 넣는다 (spec.md 4-2)
  const { profileName } = useMyProfileName();

  const [groupName, setGroupName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const trimmedGroupName = groupName.trim();
  const trimmedDisplayName = displayName.trim();

  // 빈 이름이면 버튼 비활성화 (spec.md 4-2)
  const isFormValid =
    trimmedGroupName.length >= 1 &&
    trimmedGroupName.length <= GROUP_NAME_MAX &&
    (profileName !== null ||
      (trimmedDisplayName.length >= 1 && trimmedDisplayName.length <= DISPLAY_NAME_MAX));

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
        displayName: profileName !== null ? null : trimmedDisplayName,
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

  // 입력칸과 버튼은 다른 화면과 같은 공통 부품을 쓴다 (spec.md 7절 공통 부품). 이름 칸의 라벨이 할 일을 말하므로 따로 설명 줄을 두지 않는다
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View className="flex-1 items-center justify-center bg-black/40 px-5">
        <View className="w-full max-w-sm gap-6 rounded-3xl bg-background p-6">
          <View className="gap-1">
            <Text className="text-3xl font-extrabold tracking-tight text-text">새 모임</Text>
            {profileName !== null ? (
              <Text className="text-base text-muted">{withRo(profileName)} 들어가요</Text>
            ) : null}
          </View>

          <View className="gap-4">
            <TextField
              label="모임 이름"
              placeholder="예: 점심 팟"
              value={groupName}
              onChangeText={(text) => {
                setGroupName(text);
                setLocalError(null);
              }}
              maxLength={GROUP_NAME_MAX}
              autoFocus
            />
            {profileName === null ? (
              <TextField
                label="내 이름"
                placeholder="예: 홍길동"
                value={displayName}
                onChangeText={(text) => {
                  setDisplayName(text);
                  setLocalError(null);
                }}
                maxLength={DISPLAY_NAME_MAX}
                onSubmitEditing={handleSubmit}
              />
            ) : null}
            {/* 서버 오류는 창 안에 보이고 창을 닫지 않는다 (spec.md 4-2) */}
            {displayErrorMessage ? (
              <Text className="text-sm font-semibold text-danger">{displayErrorMessage}</Text>
            ) : null}
          </View>

          <View className="flex-row gap-2">
            <View className="flex-1">
              <Button label="취소" variant="secondary" onPress={handleClose} disabled={isPending} />
            </View>
            <View className="flex-1">
              <Button
                label="만들기"
                onPress={handleSubmit}
                disabled={!isFormValid}
                loading={isPending}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
