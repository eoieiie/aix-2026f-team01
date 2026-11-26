import '@/global.css';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SplashScreen, Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthGate } from '@/components/auth-gate';
import { updateOnLaunch } from '@/lib/launch-update';

// 앱을 새로 열 때 새 판이 있으면 받아서 바로 다시 불러온다 (명세 4-31). 웹과 개발 모드는 하지 않는다.
// 확인하는 동안(최대 4초) 시작 화면을 가린 채 둔다
const UPDATE_ON_LAUNCH = Platform.OS !== 'web' && !__DEV__ && Updates.isEnabled;
if (UPDATE_ON_LAUNCH) SplashScreen.preventAutoHideAsync().catch(() => undefined);
// 한 번 실행에 한 번만
let launchUpdateStarted = false;

function useUpdateOnLaunch() {
  useEffect(() => {
    if (!UPDATE_ON_LAUNCH || launchUpdateStarted) return;
    launchUpdateStarted = true;
    updateOnLaunch({ updates: Updates, store: AsyncStorage }).then((result) => {
      // 다시 불러오면 새 판이 시작 화면을 이어서 닫는다
      if (result !== 'reloaded') SplashScreen.hideAsync().catch(() => undefined);
    });
  }, []);
}

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());
  useUpdateOnLaunch();
  // 쿠폰 현황판(운영자, 사장님)과 소개 화면은 노트북에서 넓게 본다 (4-28, 4-30). 나머지 화면은 폭 480 안에 그린다
  const pathname = usePathname();
  const wide = pathname.startsWith('/admin') || pathname.startsWith('/owner') || pathname === '/about';

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
