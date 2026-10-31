import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { COPIED_TOAST_MS } from '@/constants';

interface InviteCardProps {
  inviteCode: string;
}

export function InviteCard({ inviteCode }: InviteCardProps) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 초대 링크는 항상 웹 주소 (spec.md 4-4)
  const webBase =
    process.env.EXPO_PUBLIC_WEB_BASE ||
    (Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.location.origin
      : 'https://babti.app');
  const inviteUrl = `${webBase}/g/${inviteCode}`;

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
      timerRef.current = setTimeout(() => {
        setCopied(false);
      }, COPIED_TOAST_MS);
    } catch {
      // 복사가 안 되면 링크 글자를 화면에 보여줘서 직접 복사하게 한다 (spec.md 4-4)
      setCopyFailed(true);
      setCopied(false);
    }
  };

  // 검은 카드. 화면의 주황은 아래 시작 버튼 하나라서, 초대 카드는 색 대신 명암으로 눈에 띄게 한다 (spec.md 7절)
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="초대 링크 복사"
      className="w-full gap-4 rounded-3xl bg-text p-5 active:opacity-90"
      onPress={handleCopy}
    >
      <View className="flex-row items-start justify-between">
        <View className="gap-1">
          <Text className="text-sm font-semibold text-on-primary/60">초대 코드</Text>
          <Text className="text-3xl font-extrabold tracking-widest text-on-primary">
            {inviteCode}
          </Text>
        </View>
        <View className="rounded-full bg-background px-4 py-2">
          <Text className="text-sm font-bold text-text">{copied ? '복사했어요' : '링크 복사'}</Text>
        </View>
      </View>

      <Text className="text-sm text-on-primary/60">
        누르면 초대 링크가 복사돼요. 친구는 앱 없이 웹에서 이름만 적고 들어와요
      </Text>

      {/* 복사가 안 되면 링크 글자를 보여줘서 직접 복사하게 한다 (spec.md 4-4) */}
      {copyFailed ? (
        <View className="gap-1 rounded-2xl bg-on-primary/10 p-3">
          <Text className="text-xs text-on-primary/60">아래 링크를 길게 눌러 복사해 주세요</Text>
          <Text selectable className="select-all text-sm font-semibold text-on-primary">
            {inviteUrl}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
