import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { formatKoreanTime, redeemRate } from '@/api/shops';
import { BarLegend, Bars, DOW_LABELS, HOUR_LABELS, Panel, StatTile, TableRow } from '@/components/board-parts';
import { Button } from '@/components/button';
import { Text } from '@/components/text';
import { useMyProfile } from '@/hooks/use-profile';
import { type AdminBoard, useAdminBoard } from '@/hooks/use-shops';

const PERIODS = [7, 30, 90];
const WIDE_MIN = 960;

// 운영자 쿠폰 현황판 (4-28). 팀(app_admins)만 본다. 서버가 확인하고 아니면 not_admin을 던진다.
// 누가 언제 어디서 쿠폰을 받고 썼는지 한눈에: 숫자 네 칸, 가게별 줄, 요일과 시간대 막대, 최근 기록.
// 주소에 ?area=zz_test를 붙이면 발표용 예시 가게의 기록만 보이고 위에 "예시 자료"라고 적는다
export default function AdminCouponsScreen() {
  const { area: rawArea } = useLocalSearchParams<{ area?: string }>();
  const area = typeof rawArea === 'string' && /^[a-z_]{2,20}$/.test(rawArea) ? rawArea : null;
  const [days, setDays] = useState(30);
  const board = useAdminBoard(days, area);
  const profile = useMyProfile();
  const notAdmin = String((board.error as { message?: string } | null)?.message ?? '').includes('not_admin');

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="gap-6 p-6 pb-16">
        <View className="flex-row flex-wrap items-center justify-between gap-4">
          <View className="gap-1">
            <Text className="text-3xl font-bold tracking-tight text-text">쿠폰 현황</Text>
            <Text className="text-sm text-muted">
              {area?.startsWith('zz') ? '예시 자료예요. 실제 가게 기록이 아니에요' : '판에서 받은 쿠폰은 한 판이 한 팀이에요'}
            </Text>
          </View>
          {/* 같은 역할은 같은 폭: 기간 세 칸 */}
          <View className="flex-row gap-2">
            {PERIODS.map((d) => (
              <Pressable
                key={d}
                accessibilityRole="button"
                accessibilityLabel={`최근 ${d}일 보기`}
                accessibilityState={{ selected: d === days }}
                onPress={() => setDays(d)}
                className={`h-11 w-24 items-center justify-center rounded-xl active:opacity-70 ${d === days ? 'bg-ink' : 'bg-surface'}`}>
                <Text className={`text-base font-bold ${d === days ? 'text-on-ink' : 'text-text'}`}>{`${d}일`}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {board.isLoading ? (
          <Text className="text-sm text-muted">현황을 불러오는 중</Text>
        ) : notAdmin ? (
          <View className="max-w-md gap-2 rounded-2xl bg-surface p-6">
            <Text className="text-xl font-bold tracking-tight text-text">운영자만 볼 수 있어요</Text>
            <Text className="text-base text-muted">
              {profile.data?.handle
                ? `팀에 내 아이디 ${profile.data.handle}를 알려 주세요`
                : '내 프로필에서 아이디로 이어 쓰기를 한 뒤 팀에 아이디를 알려 주세요'}
            </Text>
          </View>
        ) : board.isError || !board.data ? (
          <View className="max-w-md gap-3">
            <Text className="text-base font-bold text-text">현황을 불러올 수 없어요</Text>
            <Button label="다시 시도" variant="secondary" onPress={() => board.refetch()} />
          </View>
        ) : (
          <BoardBody board={board.data} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function BoardBody({ board }: { board: AdminBoard }) {
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_MIN;
  const rate = redeemRate(board.totals);
  const when = (iso: string | null) => (iso ? formatKoreanTime(iso) : '-');

  const shops = (
    <Panel title="가게별" note="쓴 팀이 많은 순">
      <View className="gap-1">
        <TableRow head cells={['가게', '받음', '씀', '인원', '마지막 사용']} flex={[3, 1, 1, 1, 3]} />
        {board.shops.length === 0 ? <Text className="px-3 text-base text-muted">쿠폰이 있는 제휴 가게가 아직 없어요</Text> : null}
        {board.shops.map((s) => (
          <TableRow
            key={s.id}
            cells={[s.name, s.claimed, s.redeemed, s.people, when(s.lastRedeemedAt)]}
            flex={[3, 1, 1, 1, 3]}
          />
        ))}
      </View>
    </Panel>
  );

  const charts = (
    <View className="gap-4">
      <Panel title="요일">
        <BarLegend />
        <Bars back={board.dowClaimed} front={board.dowRedeemed} labels={DOW_LABELS} />
      </Panel>
      <Panel title="시간대">
        <Bars back={board.hourClaimed} front={board.hourRedeemed} labels={HOUR_LABELS} />
      </Panel>
    </View>
  );

  return (
    <View className="gap-6">
      <View className="flex-row flex-wrap gap-3">
        <StatTile value={String(board.totals.claimed)} label="받은 쿠폰(팀)" />
        <StatTile value={String(board.totals.redeemed)} label="쓴 쿠폰(팀)" />
        <StatTile value={rate === null ? '-' : `${rate}%`} label="사용률" />
        <StatTile value={String(board.totals.shops)} label="쿠폰이 나간 가게" />
      </View>

      {wide ? (
        <View className="flex-row items-start gap-4">
          <View style={{ flex: 3 }}>{shops}</View>
          <View style={{ flex: 2 }}>{charts}</View>
        </View>
      ) : (
        <View className="gap-4">
          {shops}
          {charts}
        </View>
      )}

      <Panel title="최근 기록" note="최근 50건">
        <View className="gap-1">
          <TableRow
            head
            cells={wide ? ['이름', '가게', '메뉴', '인원', '받은 때', '쓴 때', '받은 길'] : ['이름', '가게', '쓴 때']}
            flex={wide ? [3, 3, 2, 1, 3, 3, 2] : [3, 3, 3]}
          />
          {board.recent.length === 0 ? <Text className="px-3 text-base text-muted">아직 받은 쿠폰이 없어요</Text> : null}
          {board.recent.map((r, i) => (
            <TableRow
              key={i}
              cells={
                wide
                  ? [
                      r.names,
                      r.shop,
                      r.menu ?? '-',
                      r.people,
                      when(r.claimedAt),
                      r.redeemedAt ? when(r.redeemedAt) : '아직 안 씀',
                      r.source === 'shop' ? '가게 화면' : '판 결과',
                    ]
                  : [r.names, r.shop, r.redeemedAt ? when(r.redeemedAt) : '아직 안 씀']
              }
              flex={wide ? [3, 3, 2, 1, 3, 3, 2] : [3, 3, 3]}
            />
          ))}
        </View>
      </Panel>
    </View>
  );
}
