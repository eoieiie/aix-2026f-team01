import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { useAnonymousAuth } from '@/hooks/use-anonymous-auth';

// 익명 로그인이 끝나야 안쪽 화면을 보여준다 (spec.md 4-1)
export function AuthGate({ children }: { children: ReactNode }) {
  const { status, retry, retrying } = useAnonymousAuth();

  if (status === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator accessibilityLabel="연결하는 중" />
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-background px-6">
        <Text className="text-lg font-semibold text-text">연결할 수 없어요</Text>
        <Pressable
          accessibilityRole="button"
          disabled={retrying}
          onPress={retry}
          className="rounded-xl bg-primary px-6 py-3 disabled:opacity-50">
          <Text className="font-semibold text-on-primary">
            {retrying ? '다시 연결하는 중' : '다시 시도'}
          </Text>
        </Pressable>
      </View>
    );
  }

  return <>{children}</>;
}
