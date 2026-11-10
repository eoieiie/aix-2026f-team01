import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { FoodDot } from '@/components/food-dot';
import { Icon } from '@/components/icon';
import { PITCH_MAX } from '@/constants';
import type { Candidate } from '@/hooks/use-session';

const VETOED_TEXT = '못 먹는 사람이 있어서 빠졌어요';

type CandidateCardProps = {
  candidate: Candidate;
  // 후보 단계: 내 후보면 어필 쓰기와 빼기 (4-9)
  onSavePitch?: (text: string) => void;
  onRemove?: () => void;
  // 투표 단계: 누르면 찍힘과 취소가 바뀐다 (4-11)
  onVote?: () => void;
  voted?: boolean;
  busy?: boolean;
};

// 후보 한 줄. 빠진 후보는 줄을 긋고 이유만 보인다. 누가 원인인지는 데이터에도 없다 (4-9 익명)
export function CandidateCard({
  candidate,
  onSavePitch,
  onRemove,
  onVote,
  voted = false,
  busy = false,
}: CandidateCardProps) {
  const [pitch, setPitch] = useState(candidate.pitch ?? '');
  const dirty = pitch !== (candidate.pitch ?? '');
  const { vetoed } = candidate;

  const body = (
    <>
      <View className="flex-row items-center gap-3">
        <FoodDot foodId={candidate.foodId} size="lg" name={candidate.foodName} />
        <View className="flex-1 gap-0.5">
          <View className="flex-row items-center gap-2">
            <Text
              className={`shrink text-xl font-extrabold tracking-tight ${
                vetoed ? 'text-muted line-through' : voted ? 'text-on-primary' : 'text-text'
              }`}>
              {candidate.foodName}
            </Text>
            {/* 직접 적은 메뉴는 연필 표시. 재료를 이름으로 짐작했다는 뜻 (4-9) */}
            {candidate.custom ? (
              <View accessibilityLabel="직접 적은 메뉴">
                <Icon name="pencil" size={16} color={voted ? 'on-primary' : 'muted'} />
              </View>
            ) : null}
          </View>
          {vetoed ? (
            <Text className="text-sm text-muted">{VETOED_TEXT}</Text>
          ) : candidate.pitch && !onSavePitch ? (
            <Text className={`text-sm ${voted ? 'text-on-primary opacity-80' : 'text-muted'}`}>
              {candidate.pitch}
            </Text>
          ) : null}
        </View>
        {onVote && !vetoed ? (
          // 고른 카드는 주황으로 꽉 채우고 흰 동그라미에 체크, 안 고른 카드는 빈 흰 동그라미. 글 대신 면과 표시로 (docs/design.md 1절 "고른 상태", 4절)
          <View className="h-11 w-11 items-center justify-center rounded-full bg-background">
            {voted ? <Icon name="check" color="primary" /> : null}
          </View>
        ) : null}
        {onRemove ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${candidate.foodName} 빼기`}
            disabled={busy}
            onPress={onRemove}
            className="h-11 w-11 items-center justify-center rounded-full bg-background active:opacity-70 disabled:opacity-50">
            <Icon name="close" size={18} />
          </Pressable>
        ) : null}
      </View>

      {onSavePitch && !vetoed ? (
        <View className="flex-row items-center gap-2">
          <TextInput
            accessibilityLabel={`${candidate.foodName} 어필`}
            value={pitch}
            onChangeText={(t) => setPitch(Array.from(t).slice(0, PITCH_MAX).join(''))}
            onSubmitEditing={() => dirty && onSavePitch(pitch)}
            placeholder="한 줄 어필 (60자)"
            className="h-12 flex-1 rounded-2xl bg-background px-4 text-base text-text placeholder:text-muted"
          />
          {dirty ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${candidate.foodName} 어필 저장`}
              disabled={busy}
              onPress={() => onSavePitch(pitch)}
              className="h-12 items-center justify-center rounded-full bg-ink px-5 active:opacity-80 disabled:opacity-50">
              <Text className="text-base font-bold text-on-ink">저장</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {!onSavePitch && candidate.isMine && !vetoed && !onVote ? (
        <Text className="text-xs text-muted">내가 올린 후보</Text>
      ) : null}
    </>
  );

  const box = `gap-3 rounded-3xl p-5 ${voted ? 'bg-primary' : 'bg-surface'}`;

  if (onVote) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: voted, disabled: vetoed || busy }}
        accessibilityLabel={`${candidate.foodName} ${voted ? '고른 것 취소' : '고르기'}`}
        disabled={vetoed || busy}
        onPress={onVote}
        className={`${box} active:opacity-80`}>
        {body}
      </Pressable>
    );
  }

  return <View className={box}>{body}</View>;
}
