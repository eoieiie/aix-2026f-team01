import { Redirect, Tabs, usePathname } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/icon';
import { TAB_BAR_GAP, TAB_BAR_HEIGHT, TAB_DOT_SIZE } from '@/constants';
import { FLOAT_SHADOW } from '@/constants/shadow';
import { isFirstWebVisit } from '@/lib/first-visit';

// 하단 탭 (4-15, 4-26, 4-31). 홈, 가게, 프로필에서만 보인다. 모임, 판 화면은 탭 밖이라 탭이 없다.
// 2026-11-26 병주 요청: 화면 아래에 떠 있는 흰 알약, 양옆 16 띄움, 그림자. 엄지가 닿는 아래쪽에 세 칸을 크게 두고,
// 목록이 알약 뒤로 지나가 화면이 위아래로 넓어 보인다. 흰 바탕에 묻히지 않게 그림자를 조금 또렷하게 둔다.
// 세 칸은 같은 크기. 지금 화면은 옅은 주황 원(44) 안에 주황 아이콘, 나머지는 회색 아이콘. 목록은 알약 뒤로 지나간다
const TABS: { name: string; icon: IconName; label: string }[] = [
  { name: 'index', icon: 'home', label: '홈' },
  { name: 'shops', icon: 'shop', label: '가게' },
  { name: 'profile', icon: 'person', label: '내 프로필' },
];

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

function TabBar({ state, navigation }: { state: any; navigation: any }) {
  const insets = useSafeAreaInsets();
  const routes = state.routes.filter((r: any) => TABS.some((t) => t.name === r.name));
  const at = Math.max(0, routes.findIndex((r: any) => r.key === state.routes[state.index]?.key));

  return (
    <View
      pointerEvents="box-none"
      className="absolute bottom-0 left-0 right-0 px-4"
      style={{ paddingBottom: insets.bottom + TAB_BAR_GAP }}>
      <View
        accessibilityRole="tablist"
        className="flex-row rounded-full bg-background px-2"
        style={[{ height: TAB_BAR_HEIGHT }, FLOAT_SHADOW]}>
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
              className="h-full flex-1 items-center justify-center active:opacity-70">
              <View
                className={`items-center justify-center rounded-full ${on ? 'bg-primary-soft' : ''}`}
                style={{ width: TAB_DOT_SIZE, height: TAB_DOT_SIZE }}>
                <Icon name={tab.icon} size={24} color={on ? 'primary' : 'muted'} />
              </View>
              {/* 시안 다: 지금 탭 아래 작은 주황 점 */}
              {on ? <View className="absolute bottom-2 h-1 w-1 rounded-full bg-primary" /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
