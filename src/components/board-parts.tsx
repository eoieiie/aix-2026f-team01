import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/text';

// 쿠폰 현황판(운영자, 사장님)이 같이 쓰는 부품 (4-28). 상자는 테두리 없이 회색 면으로 나눈다

// 큰 숫자 하나와 그 이름. 한 줄에 같은 폭으로 놓는다
export function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <View accessible accessibilityLabel={`${label} ${value}`} className="flex-1 gap-1 rounded-3xl bg-surface p-4">
      <Text className="text-3xl font-bold tracking-tight text-text">{value}</Text>
      <Text className="text-sm text-muted">{label}</Text>
    </View>
  );
}

// 제목이 붙은 회색 면
export function Panel({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <View className="gap-4 rounded-3xl bg-surface p-4">
      <View className="flex-row items-baseline justify-between gap-3">
        <Text className="text-lg font-bold text-text">{title}</Text>
        {note ? <Text className="text-xs text-muted">{note}</Text> : null}
      </View>
      {children}
    </View>
  );
}

const BAR_HEIGHT = 96;

// 막대 그래프. 옅은 막대가 받은 팀, 검정 막대가 쓴 팀. 아래에 이름(요일, 시)을 적는다.
// labels가 비어 있는 칸은 이름을 적지 않는다(시간대는 3시간마다 적는다)
export function Bars({ back, front, labels }: { back: number[]; front: number[]; labels: string[] }) {
  const max = Math.max(1, ...back, ...front);
  const total = back.reduce((a, b) => a + b, 0);
  return (
    <View
      accessible
      accessibilityLabel={`받은 팀 ${total}, 쓴 팀 ${front.reduce((a, b) => a + b, 0)}`}
      className="gap-2">
      <View className="flex-row items-end gap-1" style={{ height: BAR_HEIGHT }}>
        {back.map((b, i) => (
          <View key={i} className="flex-1 justify-end" style={{ height: BAR_HEIGHT }}>
            <View
              className="justify-end overflow-hidden rounded bg-surface-strong"
              style={{ height: Math.max(b > 0 ? 4 : 2, Math.round((b / max) * BAR_HEIGHT)) }}>
              <View className="rounded bg-ink" style={{ height: Math.round(((front[i] ?? 0) / max) * BAR_HEIGHT) }} />
            </View>
          </View>
        ))}
      </View>
      {/* 시간대 막대는 칸이 좁아 "12시"가 잘린다. 이름을 칸 양옆으로 16씩 넘쳐 그리게 해서 가운데에 맞춘다 */}
      <View className="h-4 flex-row gap-1">
        {labels.map((l, i) => (
          <View key={i} className="flex-1">
            {l ? (
              <Text
                className="text-center text-xs text-muted"
                style={{ position: 'absolute', left: -16, right: -16, maxWidth: 999 }}>
                {l}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

export const DOW_LABELS = ['월', '화', '수', '목', '금', '토', '일'];
export const HOUR_LABELS = Array.from({ length: 24 }, (_, h) => (h % 3 === 0 ? `${h}시` : ''));

// 막대 색이 뜻하는 것. 그래프 위에 한 번만 둔다
export function BarLegend() {
  return (
    <View className="flex-row items-center gap-4">
      <View className="flex-row items-center gap-2">
        <View className="h-3 w-3 rounded bg-surface-strong" />
        <Text className="text-xs text-muted">받은 팀</Text>
      </View>
      <View className="flex-row items-center gap-2">
        <View className="h-3 w-3 rounded bg-ink" />
        <Text className="text-xs text-muted">쓴 팀</Text>
      </View>
    </View>
  );
}

// 표의 한 줄. 칸 폭은 flex 비율로 받는다. 머리 줄은 작은 회색 글자
export function TableRow({ cells, flex, head = false }: { cells: (string | number)[]; flex: number[]; head?: boolean }) {
  return (
    <View className={`flex-row items-center gap-3 ${head ? '' : 'min-h-11 rounded-lg bg-background px-3'} ${head ? 'px-3' : ''}`}>
      {cells.map((c, i) => (
        <Text
          key={i}
          style={{ flex: flex[i] ?? 1 }}
          className={head ? 'text-xs font-semibold text-muted' : i === 0 ? 'text-base font-semibold text-text' : 'text-base text-text'}>
          {c}
        </Text>
      ))}
    </View>
  );
}
