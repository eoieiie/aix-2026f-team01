import { type RefObject, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, Share, type View } from 'react-native';
import { Text } from '@/components/text';

import { COPIED_TOAST_MS } from '@/constants';

// 공유 버튼 (4-15, 4-17). 검정(bg-ink): 카드가 이미 주황이라 버튼까지 주황이면 강조가 둘이 된다 (docs/design.md 순간 3).
// 앱: captureRef가 있으면 카드를 그림으로 찍어 공유 창(react-native-view-shot, expo-sharing, 4-25).
// 그 모듈이 없는 옛 앱 판이거나 찍기·공유가 실패하면 글 공유로 떨어진다. 화면에 오류는 띄우지 않는다.
// 웹: 글. 공유 창이 있으면 그것, 없으면 복사하고 "복사했어요" (웹에는 화면을 그림으로 찍는 모듈을 싣지 않는다)
async function shareCardImage(ref: RefObject<View | null>): Promise<boolean> {
  try {
    if (!ref.current) return false;
    const shot = await import('react-native-view-shot');
    const sharing = await import('expo-sharing');
    if (!(await sharing.isAvailableAsync())) return false;
    const uri = await shot.captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile' });
    await sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: '이번 끼니' });
    return true;
  } catch {
    return false;
  }
}

export function ShareButton({
  text,
  label = '공유',
  captureRef,
}: {
  text: string;
  label?: string;
  captureRef?: RefObject<View | null>;
}) {
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
        if (captureRef && (await shareCardImage(captureRef))) return;
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
        className="h-14 items-center justify-center rounded-2xl bg-ink px-6 active:opacity-80">
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
