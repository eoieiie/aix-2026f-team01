import '@/global.css';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthGate } from '@/components/auth-gate';

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        {/* 노트북 화면에서는 가운데 폭 480 안에만 그리고 바깥은 회색으로 둔다. 폰에서는 화면 폭 그대로 (docs/design.md 4절) */}
        <View className="flex-1 items-center bg-surface">
          <View className="w-full max-w-[480px] flex-1 overflow-hidden bg-background">
            <AuthGate>
              <Stack screenOptions={{ headerShown: false }} />
            </AuthGate>
          </View>
        </View>
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
