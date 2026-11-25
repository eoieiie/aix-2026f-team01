import '@/global.css';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthGate } from '@/components/auth-gate';

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());
  // 쿠폰 현황판(운영자, 사장님)은 노트북에서 넓게 본다 (4-28). 나머지 화면은 폭 480 안에 그린다
  const pathname = usePathname();
  const wide = pathname.startsWith('/admin') || pathname.startsWith('/owner');

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        {/* 노트북 화면에서는 가운데 폭 480 안에만 그리고 바깥은 회색으로 둔다. 폰에서는 화면 폭 그대로 (docs/design.md 4절) */}
        <View className="flex-1 items-center bg-surface">
          <View className={`w-full flex-1 overflow-hidden bg-background ${wide ? '' : 'max-w-[480px]'}`}>
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
