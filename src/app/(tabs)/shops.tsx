import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { filterShops, SHOP_KINDS, shopLine, splitCoupons } from '@/hooks/use-shops';
import { CouncilRecord } from '@/components/council-benefit';
import { ShopThumb } from '@/components/shop-thumb';
import { useCouncilBenefits, type CouncilBenefit } from '@/hooks/use-council-benefits';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { ShopRow } from '@/components/shop-row';
import { Text } from '@/components/text';
import { choiceSurface } from '@/components/choice-colors';
import { TextField } from '@/components/text-field';
import { FOOD_NAME_MAX, SHOP_THUMB_SIZE, TAB_BAR_SPACE } from '@/constants';
import { OSM_CREDIT } from '@/hooks/use-restaurants';
import { type Shop, type ShopKind, useMyCoupons, useShops } from '@/hooks/use-shops';

// 가게 탭 (4-26). 학교 앞 식당과 카페. 위에 종류 고르기(같은 폭 격자)와 찾기, 제휴 가게가 먼저 온다.
// 칸마다 왼쪽 그림(가게 사진, 없으면 대표 메뉴 그림), 이름, 종류와 걸어서 몇 분, 제휴면 혜택 한 줄
export default function ShopsScreen() {
  const router = useRouter();
  const { shops, isLoading, isError, refetch } = useShops();
  const { coupons } = useMyCoupons();
  const [kind, setKind] = useState<ShopKind>('all');
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'mine' | 'all' | null>(null);
  const council = useCouncilBenefits();
  const entries = scope ? council.benefits.filter((b) => b.college === (scope === 'mine' ? council.college : 'all')) : [];
  const shown = entries.filter((b) => (b.shop_name ?? b.council_name).toLowerCase().includes(query.trim().toLowerCase()));
  const list = useMemo(() => filterShops(shops, kind, query), [shops, kind, query]);
  const readyCount = useMemo(() => splitCoupons(coupons, new Date()).ready.length, [coupons]);

  const header = (
    <View className="gap-4 pb-4">
      <View className="flex-row gap-2">
        {(['mine', 'all'] as const).map((key) => (
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
              setQuery('');
            }}
            className={`min-h-11 flex-1 items-center justify-center rounded-xl active:opacity-70 ${scope === key ? 'bg-ink' : 'bg-surface'}`}
            style={choiceSurface(scope === key)}>
            <Text className={`text-sm font-bold ${scope === key ? 'text-on-ink' : 'text-text'}`}>
              {key === 'mine' ? '내 단과대 제휴' : '총학생회 제휴'}
            </Text>
          </Pressable>
        ))}
      </View>
      {!scope ? <>
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
                  <Text className={`text-base font-bold ${on ? 'text-on-ink' : 'text-text'}`}>{k.label}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
      </> : null}
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
            {readyCount > 0 ? <Text className="text-base font-bold text-text">{readyCount}</Text> : null}
          </Pressable>
        </View>

        <View className="h-6" />

        {isLoading ? (
          <Text className="text-sm text-muted">가게를 불러오는 중</Text>
        ) : isError ? (
          <View className="gap-3">
            <Text className="text-base font-bold text-text">가게를 불러올 수 없어요</Text>
            <Text className="text-sm text-muted">인터넷 연결을 확인하고 다시 시도해 주세요</Text>
            <Button label="다시 시도" variant="secondary" onPress={() => refetch()} />
          </View>
        ) : (
          <FlatList<Shop | CouncilBenefit>
            data={scope ? shown : list}
            keyExtractor={(item) => `${'shop_name' in item ? 'council' : 'shop'}-${item.id}`}
            renderItem={({ item }) => 'shop_name' in item ? (
              <View className="min-h-20 flex-row gap-3 rounded-2xl bg-surface p-4">
                {item.shop_name ? <ShopThumb name={item.shop_name} cuisine={null} photoUrl={null} thumbUrl={null} size={56} onSurface /> : null}
                <View className="flex-1">
                  <CouncilRecord entry={item} showName />
                  {item.restaurant_id ? (
                    <Pressable accessibilityRole="link" className="min-h-11 justify-center" onPress={() => router.push(`/shops/${item.restaurant_id}`)}>
                      <Text className="text-sm font-bold text-text">가게 상세 보기</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
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
              <View className="items-center gap-4 rounded-2xl bg-surface p-6">
                <Text className="text-lg font-bold text-text">{scope && council.isFetching ? '제휴를 불러오는 중' : scope && council.isError ? '제휴를 불러올 수 없어요' : '찾는 가게가 없어요'}</Text>
                <Button
                  label="전체 보기"
                  variant="secondary"
                  className="self-center bg-background px-8"
                  onPress={() => {
                    setScope(null);
                    setKind('all');
                    setQuery('');
                  }}
                />
              </View>
            }
            ListFooterComponent={!scope && list.length > 0 ? <Text className="pt-4 text-xs text-muted">{OSM_CREDIT}</Text> : null}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
