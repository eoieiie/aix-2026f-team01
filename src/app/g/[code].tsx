import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { TextField } from '@/components/text-field';
import colors from '@/constants/colors.json';
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
        <ActivityIndicator color={colors.primary} accessibilityLabel="모임을 찾는 중" />
      </SafeAreaView>
    );
  }

  if (error || !invite) {
    const notFound = inviteErrorCode(error) === 'group_not_found';
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-background px-6">
        <Text className="text-lg font-bold text-text">
          {notFound ? '모임을 찾을 수 없어요' : '연결할 수 없어요'}
        </Text>
        <View className="w-full max-w-xs">
          {notFound ? (
            <Button label="홈으로" onPress={() => router.replace('/')} />
          ) : (
            <Button label="다시 시도" variant="secondary" onPress={() => refetch()} loading={retrying} />
          )}
        </View>
      </SafeAreaView>
    );
  }

  const joinErrorCode = inviteErrorCode(joinError);
  // 문구가 정해진 오류는 그 문구, 아니면 네트워크 오류로 보고 버튼을 "다시 시도"로 바꾼다
  const joinErrorMessage = joinError ? (joinErrorCode ? joinError.message : '연결할 수 없어요') : null;
  const failedOnNetwork = !!joinError && !joinErrorCode;

  if (invite.isMember) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-background px-6">
        {joinErrorMessage ? (
          <>
            <Text className="text-lg font-bold text-text">{joinErrorMessage}</Text>
            <View className="w-full max-w-xs">
              <Button label="다시 시도" variant="secondary" onPress={() => enter(null)} loading={isPending} />
            </View>
          </>
        ) : (
          <ActivityIndicator color={colors.primary} accessibilityLabel="모임으로 가는 중" />
        )}
      </SafeAreaView>
    );
  }

  const profileName = askName ? null : invite.profileName;
  const trimmedName = name.trim();
  // 이름이 비면 버튼이 꺼진다
  const canSubmit = profileName !== null || trimmedName.length >= 1;
  const submit = () => {
    if (canSubmit && !isPending) enter(profileName !== null ? null : trimmedName);
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 justify-center gap-8 px-5">
        {/* 초대받은 모임 카드: 브랜드 주황 바탕으로 환영 느낌 강화 */}
        <View className="gap-3 rounded-3xl bg-primary p-6">
          <Text className="text-base font-bold text-on-primary opacity-80">초대받은 모임</Text>
          <Text className="text-5xl font-extrabold leading-tight tracking-tight text-on-primary">
            {invite.groupName}
          </Text>
          <Text className="text-base font-semibold text-on-primary opacity-90">
            가입 없이 이름만 적으면 들어가요
          </Text>
        </View>

        {profileName !== null ? (
          <Card>
            <Text className="text-sm text-muted">이 이름으로 들어가요</Text>
            <Text className="text-xl font-bold text-text">{profileName}</Text>
            {joinErrorMessage ? <Text className="text-sm text-danger">{joinErrorMessage}</Text> : null}
          </Card>
        ) : (
          <TextField
            value={name}
            onChangeText={(text) => {
              setName(text);
              reset();
            }}
            maxLength={DISPLAY_NAME_MAX}
            label="모임에서 쓸 이름"
            placeholder="예: 홍길동"
            error={joinErrorMessage}
            autoFocus
            onSubmitEditing={submit}
          />
        )}

        <Button
          label={
            failedOnNetwork
              ? '다시 시도'
              : profileName !== null
                ? `${withRo(profileName)} 들어갈게요`
                : '들어가기'
          }
          onPress={submit}
          disabled={!canSubmit}
          loading={isPending}
        />
      </View>
    </SafeAreaView>
  );
}
