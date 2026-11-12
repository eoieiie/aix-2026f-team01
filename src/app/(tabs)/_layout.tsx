import { Tabs } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/icon';
import { TAB_BAR_HEIGHT } from '@/constants';

// 하단 탭 (4-15, #41). 홈과 프로필에서만 보인다. 모임, 판 화면은 탭 밖이라 탭이 없다.
// 떠 있는 검정 알약에 아이콘만. 지금 화면만 흰색, 나머지는 회색 (docs/design.md 1절)
const TABS: { name: string; icon: IconName; label: string }[] = [
  { name: 'index', icon: 'home', label: '홈' },
  { name: 'profile', icon: 'person', label: '내 프로필' },
];

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <PillTabBar {...props} />}>
      {TABS.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{ title: t.label }} />
      ))}
    </Tabs>
  );
}

function PillTabBar({ state, navigation }: { state: any; navigation: any }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="box-none"
      className="absolute bottom-0 left-0 right-0 items-center"
      style={{ paddingBottom: insets.bottom + 16 }}>
      <View className="flex-row gap-2 rounded-full bg-ink p-2" style={{ height: TAB_BAR_HEIGHT }}>
        {state.routes.map((route: any, i: number) => {
          const tab = TABS.find((t) => t.name === route.name);
          if (!tab) return null;
          const on = state.index === i;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: on }}
              onPress={() => {
                if (!on) navigation.navigate(route.name);
              }}
              className="h-12 w-16 items-center justify-center rounded-full active:opacity-70">
              <Icon name={tab.icon} size={24} color={on ? 'on-ink' : 'muted'} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
