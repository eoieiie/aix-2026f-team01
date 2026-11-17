import { useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, IconButton, type IconName } from '@/components/icon';
import { QrCode } from '@/components/qr-code';
import { COPIED_TOAST_MS } from '@/constants';

// 초대 링크는 항상 웹 주소 (spec.md 4-4). 미리보기에서는 그 미리보기 주소가 된다
export function inviteUrlFor(inviteCode: string) {
  const webBase =
    process.env.EXPO_PUBLIC_WEB_BASE ||
    (Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.location.origin
      : 'https://babti.expo.app');
  return `${webBase}/g/${inviteCode}`;
}

interface InviteCardProps {
  inviteCode: string;
  groupName: string;
}

// 검은 초대 카드. 코드 아래에 같은 크기의 버튼 둘: 링크 복사(단톡방에 보낼 때), QR(옆 사람이 폰 카메라로 찍을 때)
// 화면의 주황은 아래 시작 버튼 하나라서, 초대 카드는 색 대신 명암으로 눈에 띄게 한다 (spec.md 7절)
export function InviteCard({ inviteCode, groupName }: InviteCardProps) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inviteUrl = inviteUrlFor(inviteCode);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleCopy = async () => {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(inviteUrl);
      } else {
        // 클립보드 미지원 환경에서는 실패로 간주하여 링크 텍스트 직접 노출
        throw new Error('Clipboard unsupported');
      }
      setCopied(true);
      setCopyFailed(false);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), COPIED_TOAST_MS);
    } catch {
      // 복사가 안 되면 링크 글자를 화면에 보여줘서 직접 복사하게 한다 (spec.md 4-4)
      setCopyFailed(true);
      setCopied(false);
    }
  };

  return (
    <View className="w-full gap-4 rounded-3xl bg-primary p-5">
      <View className="gap-1">
        <Text className="text-sm font-semibold text-on-primary opacity-80">초대 코드</Text>
        <Text className="text-4xl font-extrabold tracking-widest text-on-primary">{inviteCode}</Text>
      </View>

      <View className="flex-row gap-2">
        <CardButton
          icon={copied ? 'check' : 'link'}
          label={copied ? '복사했어요' : '링크 복사'}
          accessibilityLabel="초대 링크 복사"
          onPress={handleCopy}
        />
        <CardButton icon="qr" label="QR" accessibilityLabel="초대 QR 보기" onPress={() => setQrOpen(true)} />
      </View>

      {/* 복사가 안 되면 링크 글자를 보여줘서 직접 복사하게 한다 (spec.md 4-4) */}
      {copyFailed ? (
        <View className="gap-1 rounded-2xl bg-on-primary/20 p-3">
          <Text className="text-xs text-on-primary opacity-80">아래 링크를 길게 눌러 복사해 주세요</Text>
          <Text selectable className="select-all text-sm font-semibold text-on-primary">
            {inviteUrl}
          </Text>
        </View>
      ) : null}

      <InviteQr
        visible={qrOpen}
        onClose={() => setQrOpen(false)}
        groupName={groupName}
        inviteCode={inviteCode}
        inviteUrl={inviteUrl}
      />
    </View>
  );
}

// 카드 안 버튼 둘은 글 길이와 상관없이 같은 폭, 같은 높이 (docs/design.md 4절)
function CardButton({
  icon,
  label,
  accessibilityLabel,
  onPress,
}: {
  icon: IconName;
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      className="h-12 flex-1 flex-row items-center justify-center gap-2 rounded-full bg-background active:opacity-80">
      <Icon name={icon} size={20} />
      <Text className="text-base font-bold text-text">{label}</Text>
    </Pressable>
  );
}

// QR 화면. 화면을 보여 주면 처음 보는 사람도 폰 카메라로 찍고 웹으로 들어온다 (spec.md 4-4, 4-5)
// 노트북 화면을 띄워 놓고 여러 명이 찍을 수 있게 QR을 화면 폭 안에서 가장 크게 그린다
function InviteQr({
  visible,
  onClose,
  groupName,
  inviteCode,
  inviteUrl,
}: {
  visible: boolean;
  onClose: () => void;
  groupName: string;
  inviteCode: string;
  inviteUrl: string;
}) {
  const { width } = useWindowDimensions();
  const size = Math.min(Math.min(width, 480) - 40, 360);

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 items-center bg-background">
        <View className="w-full max-w-[480px] flex-1 px-5 pt-3">
          <View className="h-12 flex-row items-center justify-end">
            <IconButton name="close" label="닫기" onPress={onClose} />
          </View>
          <View className="flex-1 items-center justify-center gap-6 pb-12">
            <Text
              className="text-center text-3xl font-extrabold tracking-tight text-text"
              numberOfLines={2}>
              {groupName}
            </Text>
            <QrCode value={inviteUrl} size={size} />
            <View className="items-center gap-1">
              <Text className="text-3xl font-extrabold tracking-widest text-text">{inviteCode}</Text>
              <Text className="text-base text-muted">카메라로 찍으면 바로 들어와요</Text>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
