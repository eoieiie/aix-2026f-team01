import { Linking, Pressable, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { councilBadge, type CouncilBenefit } from '@/hooks/use-council-benefits';

// inline: 이름 바로 옆(줄의 가운데 맞춤을 따른다). 아니면 세로 묶음 안에서 왼쪽에 붙는다
export function CouncilBadge({ college, inline = false }: { college: CouncilBenefit['college']; inline?: boolean }) {
  return (
    // "광고"(AdBadge)와 같은 역할이라 같은 크기와 모양
    <View className={`shrink-0 rounded-lg bg-surface-strong px-2 ${inline ? '' : 'self-start'}`}>
      <Text className="text-xs font-bold text-muted">{councilBadge(college)}</Text>
    </View>
  );
}

export function CouncilRecord({ entry, showBadge = false }: { entry: CouncilBenefit; showBadge?: boolean }) {
  const [, month, day] = entry.checked_on.split('-');
  return (
    <View className="gap-2">
      {showBadge ? <CouncilBadge college={entry.college} /> : null}
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
