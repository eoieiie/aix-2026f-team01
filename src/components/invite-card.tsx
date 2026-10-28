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

  return (
    <Pressable
      className="w-full rounded-2xl bg-surface p-5 active:opacity-90"
      onPress={handleCopy}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="text-xs font-semibold uppercase tracking-wider text-muted">
            초대 코드
          </Text>
          <Text className="mt-1 font-mono text-2xl font-bold tracking-widest text-text">
            {inviteCode}
          </Text>
        </View>

        <View
          className={`rounded-xl px-4 py-2 ${
            copied ? 'bg-primary' : 'bg-background'
          }`}
        >
          <Text
            className={`text-xs font-bold ${
              copied ? 'text-on-primary' : 'text-primary'
            }`}
          >
            {copied ? '복사했어요' : '링크 복사'}
          </Text>
        </View>
      </View>

      <Text className="mt-2 text-xs text-muted">
        카드를 누르면 친구를 초대할 수 있는 웹 링크가 복사돼요.
      </Text>

      {/* 복사 실패 시 또는 링크 직접 복사용 텍스트 표시 */}
      {copyFailed ? (
        <View className="mt-3 rounded-lg bg-background p-2.5">
          <Text className="text-xs text-muted">아래 링크를 길게 눌러 직접 복사해주세요:</Text>
          <Text className="mt-1 select-all font-mono text-xs font-medium text-primary">
            {inviteUrl}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
