import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { HANDLE_MAX } from '@/constants';
import { accountErrorMessage, useAccount } from '@/hooks/use-account';

type Mode = 'claim' | 'signIn';

// 4-19 아이디로 이어 쓰기. 홈 위쪽 사람 아이콘을 누르면 뜨는 창.
// 모양은 모임 만들기 창과 같다(가운데 카드, 여백 24, 아래 버튼 둘)
export function AccountSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { loginId, claim, signIn, signOut } = useAccount();
  const [mode, setMode] = useState<Mode>('claim');
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');

  const action = mode === 'claim' ? claim : signIn;
  const busy = claim.isPending || signIn.isPending || signOut.isPending;
  const error = action.error ?? signOut.error;

  const close = () => {
    setId('');
    setPassword('');
    claim.reset();
    signIn.reset();
    signOut.reset();
    onClose();
  };

  const submit = () => {
    if (busy) return;
    action.mutate({ loginId: id.trim(), password }, { onSuccess: close });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View className="flex-1 items-center justify-center bg-black/40 px-5">
        <View className="w-full max-w-sm gap-6 rounded-3xl bg-background p-6">
          {loginId ? (
            <>
              <View className="gap-1">
                <Text className="text-3xl font-extrabold tracking-tight text-text">@{loginId}</Text>
                <Text className="text-base text-muted">다른 기기에서도 이 아이디로 들어와요</Text>
              </View>
              {error ? <Text className="text-sm font-semibold text-danger">{accountErrorMessage(error)}</Text> : null}
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <Button label="닫기" variant="secondary" onPress={close} />
                </View>
                <View className="flex-1">
                  <Button
                    label="로그아웃"
                    variant="secondary"
                    onPress={() => signOut.mutate(undefined, { onSuccess: close })}
                    loading={signOut.isPending}
                  />
                </View>
              </View>
            </>
          ) : (
            <>
              {/* 같은 크기의 칸 둘. 고른 칸만 검정 (판 화면 단계 표시와 같은 모양) */}
              <View className="flex-row gap-2">
                {(
                  [
                    ['claim', '아이디 만들기'],
                    ['signIn', '로그인'],
                  ] as const
                ).map(([value, label]) => {
                  const on = mode === value;
                  return (
                    <Pressable
                      key={value}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      onPress={() => {
                        setMode(value);
                        claim.reset();
                        signIn.reset();
                      }}
                      className={`h-11 flex-1 items-center justify-center rounded-full ${on ? 'bg-primary' : 'bg-surface'}`}>
                      <Text className={`text-base font-bold ${on ? 'text-on-primary' : 'text-muted'}`}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View className="gap-4">
                <TextField
                  label="아이디"
                  placeholder="영어 소문자, 숫자 3~16자"
                  value={id}
                  onChangeText={(t) => setId(t.toLowerCase())}
                  maxLength={HANDLE_MAX}
                  showCount={false}
                  autoCapitalize="none"
                  autoFocus
                />
                <TextField
                  label="비밀번호"
                  placeholder="6자 이상"
                  value={password}
                  onChangeText={setPassword}
                  maxLength={64}
                  showCount={false}
                  secure
                  autoCapitalize="none"
                  onSubmitEditing={submit}
                />
                {error ? (
                  <Text className="text-sm font-semibold text-danger">{accountErrorMessage(error)}</Text>
                ) : (
                  <Text className="text-sm text-muted">
                    {mode === 'claim'
                      ? '지금 기록이 이 아이디에 남아요'
                      : '이 기기에서 쓰던 기록은 옮겨지지 않아요'}
                  </Text>
                )}
              </View>

              <View className="flex-row gap-2">
                <View className="flex-1">
                  <Button label="취소" variant="secondary" onPress={close} disabled={busy} />
                </View>
                <View className="flex-1">
                  <Button
                    label={mode === 'claim' ? '만들기' : '들어가기'}
                    onPress={submit}
                    disabled={id.trim().length === 0 || password.length === 0}
                    loading={action.isPending}
                  />
                </View>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
