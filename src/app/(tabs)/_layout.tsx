import { Redirect, Tabs, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FadeEdge } from '@/components/fade-edge';
import { Icon, type IconName } from '@/components/icon';
import colors from '@/constants/colors.json';
import { TAB_BAR_FADE, TAB_BAR_GAP, TAB_BAR_HEIGHT, TAB_ITEM_WIDTH } from '@/constants';
import { isFirstWebVisit } from '@/lib/first-visit';

// 하단 탭 (4-15, 4-26, 4-31). 홈, 가게, 프로필에서만 보인다. 모임, 판 화면은 탭 밖이라 탭이 없다.
// 화면 아래 가운데에 떠 있는 회색 알약, 세 칸은 같은 크기. 지금 화면 칸만 검정 둥근 칸에 흰 아이콘, 나머지는 회색 아이콘.
// 주황은 쓰지 않는다 (2026-11-26 병주가 시안 넷 중 B안 "떠 있는 회색 알약"을 고름. "안 예쁘고 비율도 안 맞는다")
const TABS: { name: string; icon: IconName; label: string }[] = [
  { name: 'index', icon: 'home', label: '홈' },
  { name: 'shops', icon: 'shop', label: '가게' },
  { name: 'profile', icon: 'person', label: '내 프로필' },
];

// 검정 칸이 옆 칸으로 옮겨 가는 시간. 200ms 안쪽
const MOVE_MS = 180;
// 알약 안 여백. 검정 칸 높이는 알약 높이에서 위아래 여백을 뺀 값
const PAD = 4;

export default function TabLayout() {
  // 웹에 처음 온 사람(로그인 기록 없음)이 루트를 열면 익명 계정을 만들기 전에 소개부터 보여준다 (4-30, 2026-11-26)
  const pathname = usePathname();
  if (isFirstWebVisit(pathname)) return <Redirect href={'/about' as any} />;

  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      {TABS.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{ title: t.label }} />
      ))}
    </Tabs>
  );
}

// 알약 뒤로 목록이 지나갈 때 칼로 자른 듯 끊기지 않게, 알약 아래는 바탕색으로 채우고 바로 위에 바탕색으로 옅어지는 띠를 둔다
function TabBar({ state, navigation }: { state: any; navigation: any }) {
  const insets = useSafeAreaInsets();
  const routes = state.routes.filter((r: any) => TABS.some((t) => t.name === r.name));
  const at = Math.max(0, routes.findIndex((r: any) => r.key === state.routes[state.index]?.key));

  const [x] = useState(() => new Animated.Value(at * TAB_ITEM_WIDTH));
  useEffect(() => {
    Animated.timing(x, {
      toValue: at * TAB_ITEM_WIDTH,
      duration: MOVE_MS,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [at, x]);

  return (
    <View
      pointerEvents="box-none"
      className="absolute bottom-0 left-0 right-0 items-center bg-background"
      style={{ paddingBottom: insets.bottom + TAB_BAR_GAP }}>
      <FadeEdge color={colors.background} edge="above" height={TAB_BAR_FADE} />
      <View
        accessibilityRole="tablist"
        className="flex-row rounded-full bg-surface"
        style={{ height: TAB_BAR_HEIGHT, padding: PAD }}>
        <Animated.View
          pointerEvents="none"
          className="absolute rounded-full bg-ink"
          style={{
            left: PAD,
            top: PAD,
            width: TAB_ITEM_WIDTH,
            height: TAB_BAR_HEIGHT - PAD * 2,
            transform: [{ translateX: x }],
          }}
        />
        {routes.map((route: any, i: number) => {
          const tab = TABS.find((t) => t.name === route.name)!;
          const on = i === at;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: on }}
              onPress={() => {
                if (!on) navigation.navigate(route.name);
              }}
              className="h-full items-center justify-center rounded-full active:opacity-70"
              style={{ width: TAB_ITEM_WIDTH }}>
              <Icon name={tab.icon} size={24} color={on ? 'on-ink' : 'muted'} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
