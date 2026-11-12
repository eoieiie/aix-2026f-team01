import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, Share, Text } from 'react-native';

import { COPIED_TOAST_MS } from '@/constants';

// 공유 버튼 (4-15, 4-17). 검정(bg-ink): 카드가 이미 주황이라 버튼까지 주황이면 강조가 둘이 된다 (docs/design.md 순간 3).
// 지금은 글로 공유한다. 앱: 기기 공유 창. 웹: 공유 창이 있으면 그것, 없으면 복사하고 "복사했어요".
// 카드 이미지 공유(react-native-view-shot, expo-sharing)는 새 네이티브 패키지라 앱을 다시 빌드할 때 붙인다 (#43)
export function ShareButton({ text, label = '공유' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const onPress = async () => {
    setFailed(false);
    try {
      if (Platform.OS !== 'web') {
        await Share.share({ message: text });
        return;
      }
      const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
      if (nav?.share) {
        try {
          await nav.share({ text });
          return;
        } catch (e: any) {
          // 사람이 공유 창을 닫은 것은 실패가 아니다
          if (e?.name === 'AbortError') return;
        }
      }
      if (!nav?.clipboard) throw new Error('clipboard');
      await nav.clipboard.writeText(text);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), COPIED_TOAST_MS);
    } catch {
      setFailed(true);
    }
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        className="h-14 items-center justify-center rounded-full bg-ink px-6 active:opacity-80">
        <Text className="text-lg font-bold text-on-ink">{copied ? '복사했어요' : label}</Text>
      </Pressable>
      {failed ? (
        <Text selectable className="text-center text-sm text-muted">
          {text}
        </Text>
      ) : null}
    </>
  );
}
