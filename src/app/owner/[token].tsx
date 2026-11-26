import { useLocalSearchParams } from 'expo-router';
import { Linking, ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BarLegend, Bars, HOUR_LABELS, Panel } from '@/components/board-parts';
import { EmptyState } from '@/components/empty-state';
import { Text } from '@/components/text';
import { type OwnerBoard, useOwnerBoard } from '@/hooks/use-shops';
import { supportMailUrl } from '@/lib/support-mail';

const WIDE_MIN = 960;

// 사장님 쿠폰 현황 (4-28). 로그인 없이 긴 토큰 주소로 연다. 그 가게 것만, 손님 이름 없이.
// 이번 주와 누적 받은 팀, 쓴 팀, 온 사람. 누적 팀이 5팀을 넘으면 시간대 막대와 메뉴 순위가 보인다
export default function OwnerScreen() {
  const { token: raw } = useLocalSearchParams<{ token: string }>();
  const token = typeof raw === 'string' ? raw : '';
  const board = useOwnerBoard(token);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="gap-6 px-4 pb-16 pt-6">
        {board.isLoading ? (
          <Text className="text-sm text-muted">현황을 불러오는 중</Text>
        ) : board.isError || !board.data ? (
          // 주소가 틀리면 다시 열어도 같아서 "다시 시도" 대신 밥BTI 팀에 묻는 메일을 연다
          <View className="w-full max-w-[480px]">
            <EmptyState
              title="주소를 다시 확인해 주세요"
              icon="link"
              action={{ label: '밥BTI 팀에 묻기', variant: 'inverse', onPress: () => void Linking.openURL(supportMailUrl()).catch(() => undefined) }}
            />
          </View>
        ) : (
          <OwnerBody board={board.data} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function OwnerBody({ board }: { board: OwnerBoard }) {
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_MIN;
  const topMenu = board.menus && board.menus.length > 0 ? board.menus[0].teams : 1;

  const week = (
    <Panel title="이번 주" note="월요일부터">
      <View className="flex-row gap-3">
        <StatTileOnPanel value={board.week.claimed} label="받은 팀" />
        <StatTileOnPanel value={board.week.redeemed} label="쓴 팀" />
        <StatTileOnPanel value={board.week.people} label="온 사람" />
      </View>
    </Panel>
  );
  const total = (
    <Panel title="처음부터">
      <View className="flex-row gap-3">
        <StatTileOnPanel value={board.total.claimed} label="받은 팀" />
        <StatTileOnPanel value={board.total.redeemed} label="쓴 팀" />
        <StatTileOnPanel value={board.total.people} label="온 사람" />
      </View>
    </Panel>
  );

  return (
    <View className="gap-6">
      <View className="gap-1">
        <Text className="text-3xl font-bold tracking-tight text-text">{board.shop.name}</Text>
        <Text className="text-base text-muted">
          {board.shop.benefit ? `밥BTI 쿠폰: ${board.shop.benefit}` : '밥BTI 쿠폰 현황'}
        </Text>
      </View>

      {wide ? (
        <View className="flex-row gap-4">
          <View className="flex-1">{week}</View>
          <View className="flex-1">{total}</View>
        </View>
      ) : (
        <View className="gap-4">
          {week}
          {total}
        </View>
      )}

      {board.hourClaimed && board.hourRedeemed ? (
        <View className={wide ? 'flex-row items-start gap-4' : 'gap-4'}>
          <View className={wide ? 'flex-1' : ''}>
            <Panel title="시간대">
              <BarLegend />
              <Bars back={board.hourClaimed} front={board.hourRedeemed} labels={HOUR_LABELS} />
            </Panel>
          </View>
          <View className={wide ? 'flex-1' : ''}>
            <Panel title="모임이 정한 메뉴" note="많은 순">
              {board.menus && board.menus.length > 0 ? (
                <View className="gap-2">
                  {board.menus.map((m) => (
                    <View key={m.name} className="gap-1">
                      <View className="flex-row justify-between gap-3">
                        <Text className="text-base font-semibold text-text">{m.name}</Text>
                        <Text className="text-base text-text">{`${m.teams}팀`}</Text>
                      </View>
                      <View className="h-2 rounded bg-surface-strong">
                        <View className="h-2 rounded bg-ink" style={{ width: `${Math.round((m.teams / topMenu) * 100)}%` }} />
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <Text className="text-base text-muted">가게 화면에서 바로 받은 쿠폰만 있어요</Text>
              )}
            </Panel>
          </View>
        </View>
      ) : (
        <Text className="text-base text-muted">{`${board.minTeams}팀이 넘으면 시간대와 메뉴가 보여요`}</Text>
      )}

      <Text className="text-xs text-muted">손님 이름은 드리지 않고 숫자만 보여 드려요</Text>
    </View>
  );
}

// 회색 면(Panel) 안에 놓이는 숫자 칸이라 흰 면으로 그린다
function StatTileOnPanel({ value, label }: { value: number; label: string }) {
  return (
    <View accessible accessibilityLabel={`${label} ${value}`} className="flex-1 gap-1 rounded-lg bg-background p-4">
      <Text className="text-3xl font-bold tracking-tight text-text">{value}</Text>
      <Text className="text-sm text-muted">{label}</Text>
    </View>
  );
}
