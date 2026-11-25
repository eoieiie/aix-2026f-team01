import { Linking, Pressable, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { councilBadge, type CouncilBenefit } from '@/hooks/use-council-benefits';

export function CouncilBadge({ college }: { college: CouncilBenefit['college'] }) {
  return (
    <View className="self-start rounded-lg bg-surface-strong px-2 py-1">
      <Text className="text-xs font-semibold text-muted">{councilBadge(college)}</Text>
    </View>
  );
}

export function CouncilRecord({ entry, showName = false }: { entry: CouncilBenefit; showName?: boolean }) {
  const [, month, day] = entry.checked_on.split('-');
  return (
    <View className="gap-2">
      {showName ? <Text className="text-base font-bold text-text">{entry.shop_name ?? entry.council_name}</Text> : null}
      {entry.shop_name ? <CouncilBadge college={entry.college} /> : null}
      {entry.benefit ? <Text className="text-base text-text">{entry.benefit}</Text> : null}
      {entry.conditions && !entry.benefit?.includes(entry.conditions) ? <Text className="text-sm text-muted">{`조건: ${entry.conditions}`}</Text> : null}
      {entry.period ? <Text className="text-sm text-muted">{`기간: ${entry.period}`}</Text> : null}
      {entry.location ? <Text className="text-sm text-muted">{entry.location}</Text> : null}
      <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL(entry.source_url).catch(() => {}); }} className="min-h-11 flex-row items-center gap-2 active:opacity-70">
        <Icon name="link" size={16} color="muted" />
        <Text className="shrink text-sm text-muted">{entry.status === 'notice' ? '학생회 공지 기준 (출처 보기)' : `출처 보기 (${Number(month)}/${Number(day)} 기준 목록)`}</Text>
      </Pressable>
    </View>
  );
}
