import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { ConfirmSheet, NameSheet, Sheet } from '@/components/sheets';
import { Button } from '@/components/button';
import { Text } from '@/components/text';
import { useMyBlocks, useSafety, safetyErrorMessage } from '@/hooks/use-safety';
import { useWebInstall } from '@/hooks/use-web-install';

// 내 프로필 아래 설정 (명세 4-24). 같은 역할 같은 크기(높이 56), 주황은 쓰지 않고 삭제만 danger 글자
export function SettingsList({
  name,
  hasType,
  onRestrictions,
  onOnboarding,
  onAccount,
}: {
  name: string;
  hasType: boolean;
  onRestrictions: () => void;
  onOnboarding: () => void;
  onAccount: () => void;
}) {
  const router = useRouter();
  const safety = useSafety();
  const install = useWebInstall();
  const [sheet, setSheet] = useState<null | 'name' | 'blocks' | 'delete1' | 'delete2'>(null);
  const blocks = useMyBlocks(sheet === 'blocks');
  const close = () => {
    safety.setName.reset();
    safety.deleteAccount.reset();
    setSheet(null);
  };
  const version = Constants.expoConfig?.version ?? '';

  return (
    <View className="gap-3">
      <Group>
        <Row icon="pencil" label="내 이름 바꾸기" onPress={() => setSheet('name')} />
        <Row icon="close" label="못 먹는 음식" onPress={onRestrictions} />
        {hasType ? <Row icon="refresh" label="밥BTI 다시 만들기" onPress={onOnboarding} /> : null}
        <Row icon="person" label="다른 기기에서 이어 쓰기" onPress={onAccount} />
      </Group>
      <Group>
        <Row label="밥BTI 소개" onPress={() => router.push('/about' as any)} />
        <Row label="차단한 사람" onPress={() => setSheet('blocks')} />
        <Row label="개인정보 처리방침" onPress={() => router.push('/privacy' as any)} />
        <Row label="이용약관" onPress={() => router.push('/terms' as any)} />
        <Row label="문의하기" onPress={() => router.push('/support' as any)} />
        {install ? <Row label="앱으로 설치" onPress={install} /> : null}
      </Group>
      <Group>
        <Row label="계정 삭제" danger onPress={() => setSheet('delete1')} />
      </Group>
      {version ? <Text className="px-1 text-sm text-muted">버전 {version}</Text> : null}

      <NameSheet
        visible={sheet === 'name'}
        title="내 이름"
        initial={name}
        maxLength={20}
        busy={safety.setName.isPending}
        error={safety.setName.error ? safetyErrorMessage(safety.setName.error) : null}
        onSave={(n) => safety.setName.mutate(n, { onSuccess: close })}
        onClose={close}
      />

      <Sheet visible={sheet === 'blocks'} onClose={close}>
        <Text className="text-2xl font-bold tracking-tight text-text">차단한 사람</Text>
        <View className="gap-2">
          {(blocks.data ?? []).length === 0 ? (
            <Text className="text-base text-muted">{blocks.isLoading ? '불러오는 중' : '차단한 사람이 없어요'}</Text>
          ) : (
            (blocks.data ?? []).map((b) => (
              <View key={b.userId} className="min-h-14 flex-row items-center gap-3 rounded-2xl bg-surface py-2 pl-4 pr-2">
                <Text className="flex-1 text-base font-bold text-text">
                  {b.displayName ?? '알 수 없는 사람'}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${b.displayName ?? ''} 차단 풀기`}
                  onPress={() => safety.unblock.mutate(b.userId, { onSuccess: () => blocks.refetch() })}
                  className="h-11 justify-center rounded-xl bg-background px-4 active:opacity-70">
                  <Text className="text-sm font-bold text-text">풀기</Text>
                </Pressable>
              </View>
            ))
          )}
        </View>
        <Button label="닫기" variant="secondary" onPress={close} />
      </Sheet>

      <ConfirmSheet
        visible={sheet === 'delete1'}
        title="계정을 지울까요?"
        body="이름, 못 먹는 음식, 밥BTI, 아이디가 지워져요. 내가 방장인 모임은 다음 사람에게 넘어가요"
        confirmLabel="다음"
        danger
        onConfirm={() => setSheet('delete2')}
        onClose={close}
      />
      <ConfirmSheet
        visible={sheet === 'delete2'}
        title="정말 지울까요?"
        body="되돌릴 수 없어요"
        confirmLabel="계정 삭제"
        danger
        busy={safety.deleteAccount.isPending}
        error={safety.deleteAccount.error ? safetyErrorMessage(safety.deleteAccount.error) : null}
        // 지우고 나면 목록을 다시 읽느라 이 화면이 사라질 수 있어 mutateAsync로 끝을 기다린 뒤 처음 화면으로 간다
        onConfirm={() =>
          safety.deleteAccount
            .mutateAsync()
            .then(() => router.replace('/' as any))
            .catch(() => undefined)
        }
        onClose={close}
      />
    </View>
  );
}

function Group({ children }: { children: React.ReactNode }) {
  return <View className="overflow-hidden rounded-2xl bg-surface">{children}</View>;
}

function Row({
  icon,
  label,
  onPress,
  danger = false,
}: {
  icon?: IconName;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="h-14 flex-row items-center gap-3 px-4 active:bg-surface-strong">
      {icon ? <Icon name={icon} size={20} /> : null}
      <Text className={`text-base font-bold ${danger ? 'text-danger' : 'text-text'}`}>{label}</Text>
    </Pressable>
  );
}
