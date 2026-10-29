import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DISPLAY_NAME_MAX } from '@/constants';
import { inviteErrorCode, useInvite, useJoinGroup, withRo } from '@/hooks/use-invite';

// 초대 링크로 참여 (spec.md 4-5). 링크를 받은 사람이 이름만 적고 들어온다
export default function InviteScreen() {
  const router = useRouter();
  const { code = '' } = useLocalSearchParams<{ code: string }>();
  const { invite, isLoading, error, retrying, refetch } = useInvite(code);
  const { join, isPending, error: joinError, reset } = useJoinGroup(code);

  const [name, setName] = useState('');
  // 프로필 이름이 이 모임에 이미 있으면 다른 이름을 적게 한다
  const [askName, setAskName] = useState(false);
  const autoJoined = useRef(false);

  const enter = async (displayName: string | null) => {
    try {
      const result = await join(displayName);
      // 진행 중인 판이 있으면 그 판으로, 없으면 모임 화면으로 (spec.md 7절 화면 사이 이동)
      router.replace(
        result.openSessionId
          ? (`/sessions/${result.openSessionId}` as Href)
          : `/groups/${result.groupId}`,
      );
    } catch (err) {
      if (inviteErrorCode(err) === 'name_taken') setAskName(true);
    }
  };

  // 이미 소속이면 묻지 않고 넘어간다
  useEffect(() => {
    if (invite?.isMember && !autoJoined.current) {
      autoJoined.current = true;
      enter(null);
    }
  });

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator accessibilityLabel="모임을 찾는 중" />
      </SafeAreaView>
    );
  }

  if (error || !invite) {
    const notFound = inviteErrorCode(error) === 'group_not_found';
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background px-6">
        <View className="w-full max-w-xs items-center rounded-2xl bg-surface p-8">
          <Text className="text-base font-bold text-text">
            {notFound ? '모임을 찾을 수 없어요' : '연결할 수 없어요'}
          </Text>
          <Pressable
            accessibilityRole="button"
            className="mt-5 w-full items-center rounded-xl bg-primary py-3 active:opacity-90 disabled:opacity-50"
            disabled={retrying}
            onPress={() => (notFound ? router.replace('/') : refetch())}
          >
            <Text className="text-sm font-bold text-on-primary">
              {notFound ? '홈으로' : retrying ? '다시 연결하는 중' : '다시 시도'}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const joinErrorCode = inviteErrorCode(joinError);
  // 문구가 정해진 오류는 그 문구, 아니면 네트워크 오류로 보고 버튼을 "다시 시도"로 바꾼다
  const joinErrorMessage = joinError
    ? joinErrorCode
      ? joinError.message
      : '연결할 수 없어요'
    : null;
  const failedOnNetwork = !!joinError && !joinErrorCode;

  if (invite.isMember) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background px-6">
        {joinErrorMessage ? (
          <View className="w-full max-w-xs items-center rounded-2xl bg-surface p-8">
            <Text className="text-base font-bold text-text">{joinErrorMessage}</Text>
            <Pressable
              accessibilityRole="button"
              className="mt-5 w-full items-center rounded-xl bg-primary py-3 active:opacity-90 disabled:opacity-50"
              disabled={isPending}
              onPress={() => enter(null)}
            >
              <Text className="text-sm font-bold text-on-primary">다시 시도</Text>
            </Pressable>
          </View>
        ) : (
          <ActivityIndicator accessibilityLabel="모임으로 가는 중" />
        )}
      </SafeAreaView>
    );
  }

  const useProfileName = !!invite.profileName && !askName;
  const trimmedName = name.trim();
  // 이름이 비면 버튼이 꺼진다
  const canSubmit = (useProfileName || trimmedName.length >= 1) && !isPending;

  const buttonLabel = isPending
    ? '들어가는 중'
    : failedOnNetwork
      ? '다시 시도'
      : useProfileName
        ? `${withRo(invite.profileName!)} 들어갈게요`
        : '들어가기';

  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-background px-6">
      <View className="w-full max-w-sm rounded-2xl bg-surface p-6">
        <Text className="text-xs font-medium text-muted">초대받은 모임</Text>
        <Text className="mt-1 text-xl font-bold text-text">{invite.groupName}</Text>

        {useProfileName ? null : (
          <View className="mt-5">
            <Text className="mb-1 text-xs font-medium text-muted">
              모임에서 쓸 이름 ({trimmedName.length}/{DISPLAY_NAME_MAX})
            </Text>
            <TextInput
              className="h-12 rounded-xl bg-background px-4 text-base text-text placeholder:text-muted"
              placeholder="예: 홍길동"
              value={name}
              onChangeText={(text) => {
                setName(text);
                reset();
              }}
              maxLength={DISPLAY_NAME_MAX}
              autoFocus
              onSubmitEditing={() => canSubmit && enter(trimmedName)}
            />
          </View>
        )}

        {joinErrorMessage ? (
          <Text className="mt-3 text-center text-xs text-danger">{joinErrorMessage}</Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          className={`mt-5 w-full items-center rounded-xl py-3 ${
            canSubmit ? 'bg-primary active:opacity-90' : 'bg-background opacity-50'
          }`}
          disabled={!canSubmit}
          onPress={() => enter(useProfileName ? null : trimmedName)}
        >
          <Text className={`text-sm font-bold ${canSubmit ? 'text-on-primary' : 'text-muted'}`}>
            {buttonLabel}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
