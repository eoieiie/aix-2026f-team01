import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Linking, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { filterShops, SHOP_KINDS, shopLine, splitCoupons } from '@/hooks/use-shops';
import { councilShopRows, useCouncilBenefits } from '@/hooks/use-council-benefits';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { ShopRow } from '@/components/shop-row';
import { Text } from '@/components/text';
import { choiceSurface } from '@/components/choice-colors';
import { TextField } from '@/components/text-field';
import { FOOD_NAME_MAX, SHOP_THUMB_SIZE, TAB_BAR_SPACE } from '@/constants';
import { collegeLabel } from '@/constants/prefs';
import { OSM_CREDIT } from '@/hooks/use-restaurants';
import { type Shop, type ShopKind, useMyCoupons, useShops } from '@/hooks/use-shops';

// 가게 탭 (4-26). 학교 앞 식당과 카페. 위에 종류 고르기(같은 폭 격자)와 찾기, 제휴 가게가 먼저 온다.
// 칸마다 왼쪽 그림(가게 사진, 없으면 대표 메뉴 그림), 이름, 종류와 걸어서 몇 분, 제휴면 혜택 한 줄
// 결과 뒤 "더 보기"(0048)는 q(메뉴 이름)나 kind(카페)를 넘긴다. 버튼의 숫자는 이 탭과 같은 filterShops로 센 수다
export default function ShopsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string; kind?: string; at?: string }>();
  const { shops, isLoading, isError, refetch } = useShops();
  const { coupons } = useMyCoupons();
  const [kind, setKind] = useState<ShopKind>('all');
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'mine' | 'all' | null>(null);
  // 새 "더 보기"로 열릴 때만 한 번 채운다(그 뒤 사람이 고친 찾기와 종류는 그대로)
  const [seenAt, setSeenAt] = useState<string | undefined>(undefined);
  if (params.at && params.at !== seenAt) {
    setSeenAt(params.at);
    setScope(null);
    setKind(SHOP_KINDS.find((x) => x.key === params.kind)?.key ?? 'all');
    setQuery(params.q ?? '');
  }
  const council = useCouncilBenefits();
  const entries = scope ? council.benefits.filter((b) => b.college === (scope === 'mine' ? council.college : 'all')) : [];
  const shown = councilShopRows(entries, shops, kind, query);
  const list = useMemo(
    () => filterShops(shops, kind, query),
    [shops, kind, query]
  );
  const source = council.college === 'computing' && scope === 'mine'
    ? 'https://app.notion.com/p/2026-2feafc7e0f1880818885e3a0fbd85aab'
    : entries[0]?.source_url;
  const councilName = scope === 'all' ? '총학생회' : council.college === 'computing' ? '소융대 학생회' : collegeLabel(council.college);
  const readyCount = useMemo(() => splitCoupons(coupons, new Date()).ready.length, [coupons]);

  const header = (
    <View className="gap-4 pb-4">
      <View className="flex-row gap-2">
        {(['mine', 'all'] as const).filter((key) => key === 'mine' || council.benefits.some((b) => b.college === 'all')).map((key) => (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityState={{ selected: scope === key }}
            onPress={() => {
              if (key === 'mine' && !council.college) {
                router.push({ pathname: '/profile/edit', params: { section: 'college' } });
                return;
              }
              setScope(scope === key ? null : key);
            }}
            className={`min-h-11 flex-1 items-center justify-center rounded-xl active:opacity-70 ${scope === key ? 'bg-ink' : 'bg-surface'}`}
            style={choiceSurface(scope === key)}>
            <Text className={`text-sm font-semibold ${scope === key ? 'text-on-ink' : 'text-text'}`}>
              {key === 'mine' ? '내 단과대 제휴' : '총학생회 제휴'}
            </Text>
          </Pressable>
        ))}
      </View>
      {/* 같은 역할은 같은 크기: 네 칸 두 줄 격자, 높이 44. 고른 칸만 검정 */}
      <View className="gap-2">
        {[SHOP_KINDS.slice(0, 4), SHOP_KINDS.slice(4)].map((row, i) => (
          <View key={i} className="flex-row gap-2">
            {row.map((k) => {
              const on = k.key === kind;
              return (
                <Pressable
                  key={k.key}
                  accessibilityRole="button"
                  accessibilityLabel={`${k.label} 가게만 보기`}
                  accessibilityState={{ selected: on }}
                  onPress={() => setKind(k.key)}
                  className={`h-11 flex-1 items-center justify-center rounded-xl active:opacity-70 ${on ? 'bg-ink' : 'bg-surface'}`} style={choiceSurface(on)}>
                  <Text className={`text-base font-semibold ${on ? 'text-on-ink' : 'text-text'}`}>{k.label}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
      <TextField
        value={query}
        onChangeText={setQuery}
        maxLength={FOOD_NAME_MAX}
        placeholder="가게 이름이나 메뉴로 찾기"
        showCount={false}
      />
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-1 px-4 pt-3">
        <View className="h-12 flex-row items-center justify-between">
          <Text className="text-3xl font-bold tracking-tight text-text">학교 앞 가게</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={readyCount > 0 ? `쿠폰함, 쓸 수 있는 쿠폰 ${readyCount}장` : '쿠폰함'}
            onPress={() => router.push('/coupons' as any)}
            className="h-12 flex-row items-center justify-center gap-2 rounded-full bg-surface px-4 active:opacity-70">
            <Icon name="ticket" />
            {readyCount > 0 ? <Text className="text-base font-semibold text-text">{readyCount}</Text> : null}
          </Pressable>
        </View>

        <View className="h-6" />

        {isLoading ? (
          <Text className="text-sm text-muted">가게를 불러오는 중</Text>
        ) : isError ? (
          <View className="gap-3">
            <Text className="text-base font-semibold text-text">가게를 불러올 수 없어요</Text>
            <Text className="text-sm text-muted">인터넷 연결을 확인하고 다시 시도해 주세요</Text>
            <Button label="다시 시도" variant="secondary" onPress={() => refetch()} />
          </View>
        ) : (
          <FlatList<Shop | ReturnType<typeof councilShopRows>[number]>
            data={scope ? shown : list}
            keyExtractor={(item) => 'entry' in item ? `council-${item.entry.id}` : `shop-${item.id}`}
            renderItem={({ item }) => 'entry' in item ? (
              <ShopRow
                id={item.shop?.id ?? 0}
                name={item.entry.shop_name ?? item.entry.council_name}
                partner={item.shop?.partner ?? false}
                info={[]}
                benefit={item.entry.benefit}
                photoUrl={item.shop?.photoUrl ?? null}
                thumbUrl={item.shop?.thumbUrl ?? null}
                cuisine={item.shop?.cuisine ?? null}
                thumbSize={56}
                hideCouncilBadge
                onOpen={() => router.push(item.shop ? `/shops/${item.shop.id}` : `/council-benefits/${item.entry.id}`)}
                card
              />
            ) : (
              <ShopRow
                id={item.id}
                name={item.name}
                partner={item.partner}
                info={shopLine(item)}
                benefit={item.partner ? item.couponText : null}
                photoUrl={item.photoUrl}
                thumbUrl={item.thumbUrl}
                cuisine={item.cuisine}
                thumbSize={SHOP_THUMB_SIZE}
                card
              />
            )}
            ItemSeparatorComponent={() => <View className="h-2" />}
            ListHeaderComponent={header}
            ListEmptyComponent={
              <View className="items-center gap-4 rounded-3xl bg-surface p-6">
                <Text className="text-lg font-bold text-text">{scope && council.isFetching ? '제휴를 불러오는 중' : scope && council.isError ? '제휴를 불러올 수 없어요' : scope && entries.length === 0 ? `아직 ${councilName ?? '내 단과대'} 제휴 목록이 없어요` : '찾는 가게가 없어요'}</Text>
                <Button
                  label="전체 보기"
                  variant="secondary"
                  className="self-center bg-background px-8"
                  onPress={() => {
                    setScope(null);
                    setKind('all');
                    setQuery('');
                    setQuery('');
                  }}
                />
              </View>
            }
            ListFooterComponent={scope && source && shown.length ? (
              <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL(source).catch(() => {}); }} className="min-h-11 justify-center">
                <Text className="text-xs text-muted">{councilName} 공지 기준, 출처 보기{entries[0]?.status === 'list_only' ? ' (11/19 기준 목록)' : ''}</Text>
              </Pressable>
            ) : !scope && list.length > 0 ? <Text className="pt-4 text-xs text-muted">{OSM_CREDIT}</Text> : null}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
