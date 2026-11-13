import type { ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import colors from '@/constants/colors.json';
import { axesView, restrictionView } from '@/constants/group-card';
import { useGroupProfileCard } from '@/hooks/use-groups';

// 4-16 모임 프로필 카드. 모임 화면의 최근 식사 아래. 회색 카드에 검정 막대 (docs/design.md 순간 3).
// 누가 무엇을 못 먹는지, 누가 어느 성향인지는 없다. 인원수만 보인다
export function GroupProfileCard({ groupId }: { groupId: string }) {
  const { card, isLoading, isError } = useGroupProfileCard(groupId);

  return (
    <View className="gap-3">
      <Text className="text-2xl font-extrabold tracking-tight text-text">우리 모임</Text>
      <View className="gap-6 rounded-3xl bg-surface p-5">
        {isLoading ? (
          <ActivityIndicator color={colors.text} accessibilityLabel="모임 카드를 불러오는 중" />
        ) : isError || !card ? (
          <Text className="text-base font-semibold text-muted">모임 카드를 불러올 수 없어요</Text>
        ) : (
          <>
            <Restrictions view={restrictionView(card)} />
            <Axes view={axesView(card)} />
          </>
        )}
      </View>
    </View>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <View className="gap-3">
      <View className="flex-row items-baseline justify-between">
        <Text className="text-lg font-extrabold text-text">{title}</Text>
        {note ? <Text className="text-sm text-muted">{note}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function Restrictions({ view }: { view: ReturnType<typeof restrictionView> }) {
  if (view.kind !== 'rows') {
    return (
      <Section title="못 먹는 것">
        <Text className="text-base font-semibold text-muted">{view.text}</Text>
      </Section>
    );
  }
  return (
    <Section title="못 먹는 것">
      {view.rows.map((r) => (
        <View key={r.tag} className="gap-2" accessibilityLabel={`${r.label} 못 먹는 사람 ${r.count}명`}>
          <View className="flex-row justify-between">
            <Text className="flex-1 text-base font-bold text-text">{r.label}</Text>
            <Text className="text-base font-bold text-text">{r.count}명</Text>
          </View>
          <View className="h-3 overflow-hidden rounded-full bg-surface-strong">
            <View className="h-3 rounded-full bg-primary" style={{ width: `${r.ratio * 100}%` }} />
          </View>
        </View>
      ))}
      {view.foodBlockCount > 0 ? (
        <View className="flex-row justify-between">
          <Text className="flex-1 text-base font-bold text-text">음식을 직접 고른 사람</Text>
          <Text className="text-base font-bold text-text">{view.foodBlockCount}명</Text>
        </View>
      ) : null}
    </Section>
  );
}

// 네 축은 가운데 0에서 양쪽으로 뻗는 막대. 왼쪽 글자 쪽이 +1
function Axes({ view }: { view: ReturnType<typeof axesView> }) {
  if (view.kind === 'hidden') {
    return (
      <Section title="입맛">
        <Text className="text-base font-semibold text-muted">{view.text}</Text>
      </Section>
    );
  }
  return (
    <Section title="입맛" note={`테스트한 ${view.tested}명 기준`}>
      {view.rows.map((a) => {
        const leftOn = a.value > 0;
        const rightOn = a.value < 0;
        return (
          <View
            key={a.key}
            className="flex-row items-center gap-3"
            accessibilityLabel={`${a.left}과 ${a.right} 중 ${a.value === 0 ? '가운데' : leftOn ? a.left : a.right} 쪽`}>
            <Text className={`w-16 text-sm font-bold ${leftOn ? 'text-text' : 'text-muted'}`}>{a.left}</Text>
            <View className="h-3 flex-1 flex-row overflow-hidden rounded-full bg-surface-strong">
              <View className="flex-1 flex-row justify-end">
                {leftOn ? <View className="h-3 bg-primary" style={{ width: `${Math.abs(a.value) * 100}%` }} /> : null}
              </View>
              <View className="h-3 w-0.5 bg-muted" />
              <View className="flex-1 flex-row">
                {rightOn ? <View className="h-3 bg-primary" style={{ width: `${Math.abs(a.value) * 100}%` }} /> : null}
              </View>
            </View>
            <Text className={`w-16 text-right text-sm font-bold ${rightOn ? 'text-text' : 'text-muted'}`}>
              {a.right}
            </Text>
          </View>
        );
      })}
    </Section>
  );
}
