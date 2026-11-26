import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, View } from 'react-native';
import { Text, TextInput } from '@/components/text';

import { FoodThumb } from '@/components/food-thumb';
import { foodTint, TINT_BG } from '@/constants/food-tint';
import { Icon } from '@/components/icon';
import { PITCH_MAX } from '@/constants';
import { INGREDIENT_TAGS, maybeLine } from '@/constants/restrictions';
import colors from '@/constants/colors.json';
import type { Candidate } from '@/hooks/use-session';

// 0010부터 빠지지 않고 표시만 한다. 찍을 수 있다
const VETOED_TEXT = '못 먹는 사람이 있어요';
// 직접 적은 메뉴의 재료는 AI가 이름으로 추정한 것이다. 재료를 다 띄우지 않고 한 줄로만 알리고, 누르면 재료와 이유를 편다
// (2026-11-25 병주 "재료 확인 필요* 문구로 바꾸기, 추정 재료 다 띄우지 않기")
const AI_LINE = '재료 확인 필요*';
const AI_FOOTNOTE = '* AI가 메뉴 이름으로 추정했어요. 가게마다 다를 수 있어요';
// 0044 가게 이름처럼 메뉴 이름이 아니면 태그 없이 이 한 줄만
const NOT_MENU_TEXT = '메뉴 이름을 적으면 재료를 알려 줘요';
const VARIES_TEXT = '가게마다 달라요';
const TAG_LABEL: Record<string, string> = Object.fromEntries(INGREDIENT_TAGS.map((t) => [t.code, t.label]));

type CandidateCardProps = {
  candidate: Candidate;
  // 후보 단계: 내 후보면 어필 쓰기와 빼기 (4-9)
  onSavePitch?: (text: string) => void;
  onRemove?: () => void;
  // 투표 단계: 누르면 찍힘과 취소가 바뀐다 (4-11)
  onVote?: () => void;
  voted?: boolean;
  // 한 메뉴에 여러 표가 켜진 판에서 내가 이 메뉴에 준 표 수. 2 이상이면 체크 대신 숫자 (0019)
  myVoteCount?: number;
  busy?: boolean;
  // 4-20 이 모임이 최근에 먹었으면 "N일 전에 먹었어요"
  eatenNote?: string | null;
  // 방금 올린 후보. 주황 선이 잠깐 보였다가 사라진다
  highlight?: boolean;
  // 남이 쓴 어필이나 직접 적은 메뉴: 신고와 차단 (4-24)
  onMore?: () => void;
  // 0044 사람 확인(내가 직접 적은 메뉴): 맞아요와 재료 더하기만. 빼기는 없다
  onConfirmAi?: () => void;
  onAddTag?: (tag: string) => void;
};

// 후보 한 칸. 왼쪽에 음식 그림, 못 먹는 사람이 있는 후보는 이름 아래 한 줄로 알린다. 누가 원인인지는 데이터에도 없다 (4-9 익명)
export function CandidateCard({
  candidate,
  onSavePitch,
  onRemove,
  onVote,
  voted = false,
  myVoteCount = 0,
  busy = false,
  eatenNote = null,
  highlight = false,
  onMore,
  onConfirmAi,
  onAddTag,
}: CandidateCardProps) {
  // 테두리는 JS로 흐려지게 한다(웹과 앱이 같게). 움직임 줄이기가 켜져 있으면 흐려지지 않고 바로 사라진다
  const [ring] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!highlight) {
      ring.setValue(0);
      return;
    }
    ring.setValue(1);
    let anim: Animated.CompositeAnimation | null = null;
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (!live || reduce) return;
        anim = Animated.sequence([
          Animated.delay(1000),
          Animated.timing(ring, { toValue: 0, duration: 400, useNativeDriver: false }),
        ]);
        anim.start();
      });
    return () => {
      live = false;
      anim?.stop();
    };
  }, [highlight, ring]);
  const [pitch, setPitch] = useState(candidate.pitch ?? '');
  const dirty = pitch !== (candidate.pitch ?? '');
  const { vetoed } = candidate;
  const aiTags = candidate.aiTags ?? [];
  const aiLabels = aiTags.map((t) => TAG_LABEL[t] ?? t);
  const [aiOpen, setAiOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  // 확실 경고가 없을 때만 약한 표시. AI만 추정한 재료가 이 판 누군가의 못 먹는 것에 걸린다 (0044)
  const maybe = !vetoed ? maybeLine(candidate.maybeTags ?? []) : null;
  const notMenu = candidate.custom && candidate.aiStatus === 'not_menu';
  const askCheck = !!onConfirmAi && candidate.isMine && candidate.custom && candidate.aiStatus === 'done' && !candidate.aiChecked;

  // 그림(56)과 오른쪽 동그라미(44)는 첫 줄에 붙인다. 글이 한 줄이면 그림 가운데에 오고, 길어지면 아래로만 늘어난다 (11/21 실기기)
  const head = (
    <View className="flex-row items-start gap-3">
      <FoodThumb foodId={candidate.foodId} size="lg" />
      <View className="min-h-[72px] flex-1 justify-center gap-1">
        <View className="flex-row items-center gap-2">
          <Text className="shrink text-xl font-bold tracking-tight text-text">{candidate.foodName}</Text>
          {/* 직접 적은 메뉴는 연필 표시. 재료를 이름으로 짐작했다는 뜻 (4-9) */}
          {candidate.custom ? (
            <View accessibilityLabel="직접 적은 메뉴">
              <Icon name="pencil" size={16} color="muted" />
            </View>
          ) : null}
        </View>
        {vetoed ? <Text className="text-sm font-semibold text-danger">{VETOED_TEXT}</Text> : null}
        {maybe ? <Text className="text-sm text-muted">{maybe}</Text> : null}
        {notMenu ? <Text className="text-sm text-muted">{NOT_MENU_TEXT}</Text> : null}
        {eatenNote ? <Text className="text-sm text-muted">{eatenNote}</Text> : null}
        {candidate.pitch && !onSavePitch ? <Text className="text-sm text-muted">{candidate.pitch}</Text> : null}
      </View>
      {onVote ? (
        // 고른 표시는 검정 동그라미에 흰 체크, 안 고른 것은 빈 흰 동그라미. 카드를 주황으로 채우지 않는다.
        // 주황은 화면 아래 주 단추 하나에만 쓴다 (docs/design.md "화면 규칙" 색)
        <View className="h-[72px] justify-center">
          <View
            className={`h-11 w-11 items-center justify-center rounded-full ${voted ? 'bg-ink' : 'bg-background'}`}>
            {myVoteCount > 1 ? (
              <Text className="text-lg font-bold text-on-ink">{myVoteCount}</Text>
            ) : voted ? (
              <Icon name="check" color="on-ink" />
            ) : null}
          </View>
        </View>
      ) : null}
      {onMore ? (
        <View className="h-[72px] justify-center">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${candidate.foodName} 신고 또는 차단`}
            onPress={onMore}
            className="h-11 w-11 items-center justify-center rounded-full bg-background active:opacity-70">
            <Icon name="more" size={18} />
          </Pressable>
        </View>
      ) : null}
      {onRemove ? (
        <View className="h-[72px] justify-center">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${candidate.foodName} 빼기`}
            disabled={busy}
            onPress={onRemove}
            className="h-11 w-11 items-center justify-center rounded-full bg-background active:opacity-70 disabled:opacity-50">
            <Icon name="close" size={18} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  // 4-22 AI가 추정해 더한 재료. 접힌 채로는 한 줄만, 누르면 재료마다 이유 한 줄. 누가 못 먹는지는 보이지 않는다.
  // 투표 카드에서도 볼 수 있게 "고르기" 버튼 밖에 따로 둔다 (버튼 안에 버튼을 두지 않는다, WCAG 4.1.2)
  const aiLine =
    aiTags.length > 0 && !askCheck ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${candidate.foodName} 재료 확인 필요, AI가 추정한 재료 ${aiLabels.join(', ')}`}
        accessibilityState={{ expanded: aiOpen }}
        onPress={() => setAiOpen((v) => !v)}
        className="min-h-11 justify-center gap-1 rounded-lg bg-background px-3 py-2 active:opacity-70">
        <Text className="text-sm font-semibold text-text">{AI_LINE}</Text>
        {aiOpen ? (
          <>
            {aiTags.map((t) => (
              <Text key={t} className="text-sm leading-5 text-muted">
                <Text className="font-bold text-text">{TAG_LABEL[t] ?? t}</Text>{' '}
                {candidate.aiNotes?.[t] ?? '흔히 들어가는 재료예요'}
                {candidate.aiBasis?.[t] === 'varies' ? ` (${VARIES_TEXT})` : ''}
              </Text>
            ))}
            <Text className="text-xs text-muted">{AI_FOOTNOTE}</Text>
          </>
        ) : null}
      </Pressable>
    ) : null;

  // 0044 사람 확인. 올린 사람에게 AI가 찾은 재료를 보이고 "맞아요"와 "재료 더하기"만 받는다. 두 단추는 같은 폭
  const sure = candidate.sureTags ?? [];
  const checkBox = askCheck ? (
    <View className="gap-3 rounded-lg bg-background p-3">
      <View className="gap-1">
        <Text className="text-sm font-semibold text-text">AI가 찾은 재료</Text>
        <Text className="text-sm text-muted">{aiLabels.length > 0 ? aiLabels.join(', ') : '찾은 재료가 없어요'}</Text>
      </View>
      <View className="flex-row gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${candidate.foodName} AI 재료 맞아요`}
          disabled={busy}
          onPress={onConfirmAi}
          className="h-11 flex-1 items-center justify-center rounded-lg bg-ink active:opacity-80 disabled:opacity-50">
          <Text className="text-base font-bold text-on-ink">맞아요</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${candidate.foodName} 재료 더하기`}
          accessibilityState={{ expanded: addOpen }}
          disabled={busy}
          onPress={() => setAddOpen((v) => !v)}
          className="h-11 flex-1 items-center justify-center rounded-lg bg-surface active:opacity-80 disabled:opacity-50">
          <Text className="text-base font-bold text-text">재료 더하기</Text>
        </Pressable>
      </View>
      {addOpen ? (
        <View className="-m-1 flex-row flex-wrap">
          {INGREDIENT_TAGS.map((t) => {
            const on = sure.includes(t.code);
            return (
              <View key={t.code} className="w-1/3 p-1">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${t.label} 더하기`}
                  accessibilityState={{ selected: on, disabled: on || busy }}
                  disabled={on || busy}
                  onPress={() => onAddTag?.(t.code)}
                  className={`h-11 items-center justify-center rounded-lg active:opacity-70 ${on ? 'bg-ink' : 'bg-surface'}`}>
                  <Text className={`text-sm font-semibold ${on ? 'text-on-ink' : 'text-text'}`}>{t.label}</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  ) : null;

  // 카드는 옅은 면 하나. 모서리 24, 안 여백 16 (docs/design.md "떠 있는 아래 탭과 박스, 글자 정돈")
  // 시안 나: 면은 그 음식의 옅은 색, 그림은 72
  const box = `gap-3 rounded-3xl p-4 ${TINT_BG[foodTint(candidate.foodId)]}`;

  if (onVote) {
    return (
      <View className={box}>
        {/* 누르는 자리는 카드 끝까지. 아래에 재료 줄이 있으면 그 위까지만 */}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: voted, disabled: busy }}
          accessibilityLabel={`${candidate.foodName}${vetoed ? `, ${VETOED_TEXT}` : maybe ? `, ${maybe}` : ''}${aiTags.length > 0 ? ', 재료 확인 필요' : ''} ${voted ? '고른 것 취소' : '고르기'}`}
          disabled={busy}
          onPress={onVote}
          className={`${aiLine ? '-mx-4 -mt-4 px-4 pt-4' : '-m-4 p-4'} active:opacity-80`}>
          {head}
        </Pressable>
        {aiLine}
      </View>
    );
  }

  return (
    <View className={box}>
      {head}
      {aiLine}
      {checkBox}

      {onSavePitch ? (
        <View className="flex-row items-center gap-2">
          {/* 카드 안 입력칸과 단추는 모서리 8 (바깥 16에서 안 여백을 뺀 값, 최소 8) */}
          <TextInput
            accessibilityLabel={`${candidate.foodName} 어필`}
            value={pitch}
            onChangeText={(t) => setPitch(Array.from(t).slice(0, PITCH_MAX).join(''))}
            onSubmitEditing={() => dirty && onSavePitch(pitch)}
            placeholder="한 줄 어필 (60자)"
            className="h-12 flex-1 rounded-lg bg-background px-4 text-base text-text placeholder:text-muted"
          />
          {dirty ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${candidate.foodName} 어필 저장`}
              disabled={busy}
              onPress={() => onSavePitch(pitch)}
              className="h-12 items-center justify-center rounded-lg bg-ink px-4 active:opacity-80 disabled:opacity-50">
              <Text className="text-base font-bold text-on-ink">저장</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {!onSavePitch && candidate.isMine ? <Text className="text-xs text-muted">내가 올린 후보</Text> : null}

      {/* Animated.View는 className을 받지 못해서 style로 쓴다. 모서리 24는 rounded-3xl과 같다 */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: 24,
          borderWidth: 4,
          borderColor: colors.primary,
          opacity: ring,
        }}
      />
    </View>
  );
}
