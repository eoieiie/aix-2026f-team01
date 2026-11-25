import { Tabs } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FadeEdge } from '@/components/fade-edge';
import { Icon, type IconName } from '@/components/icon';
import colors from '@/constants/colors.json';
import { TAB_BAR_HEIGHT } from '@/constants';

// 하단 탭 (4-15, 4-26). 홈, 가게, 프로필에서만 보인다. 모임, 판 화면은 탭 밖이라 탭이 없다.
// 흰 바탕에 회색 아이콘, 지금 화면만 주황 아이콘. 주황 알약은 뺐다 (2026-11-25 병주 "주황색이 너무 많은데, 포인트컬러로 남기면 좋아")
const TABS: { name: string; icon: IconName; label: string }[] = [
  { name: 'index', icon: 'home', label: '홈' },
  { name: 'shops', icon: 'shop', label: '가게' },
  { name: 'profile', icon: 'person', label: '내 프로필' },
];

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      {TABS.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{ title: t.label }} />
      ))}
    </Tabs>
  );
}

// 화면 아래에 붙은 흰 막대. 탭은 같은 폭으로 나눈다. 목록 끝이 막대에 칼로 자른 듯 걸리지 않게 선 대신 바로 위에 흰색으로 옅어지는 띠(2026-11-25)
function TabBar({ state, navigation }: { state: any; navigation: any }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="absolute bottom-0 left-0 right-0 bg-background"
      style={{ paddingBottom: insets.bottom }}>
      <FadeEdge color={colors.background} edge="above" height={32} />
      <View className="flex-row" style={{ height: TAB_BAR_HEIGHT }}>
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
              className="flex-1 items-center justify-center active:opacity-70">
              <Icon name={tab.icon} size={26} color={on ? 'primary' : 'muted'} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
