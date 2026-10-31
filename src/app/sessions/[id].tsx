import { useLocalSearchParams, useRouter } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { CandidateCard } from '@/components/candidate-card';
import { FoodSearch } from '@/components/food-search';
import { Roulette } from '@/components/roulette';
import colors from '@/constants/colors.json';
import { MAX_VOTES_PER_PERSON, ROULETTE_RESULT_FALLBACK_MS } from '@/constants';
import {
  type Participant,
  rouletteSlices,
  SessionError,
  sessionErrorMessage,
  type SessionView,
  useFoods,
  useSession,
  useSessionActions,
  useVoteCounts,
} from '@/hooks/use-session';

// 판 화면 (spec.md 4-8 ~ 4-13, 7절 /sessions/{판 id}). 판 상태에 따라 후보 → 투표 → 룰렛 결과로 바뀐다
export default function SessionScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = id ?? '';
  const { session, isLoading, error, retry } = useSession(sessionId);

  // 이 화면에서 투표 단계를 본 적이 있으면, 결과가 오는 순간 원판을 돌린다
  const [sawVoting, setSawVoting] = useState(false);
  if (session?.status === 'voting' && !sawVoting) setSawVoting(true);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={colors.primary} accessibilityLabel="판을 불러오는 중" />
      </SafeAreaView>
    );
  }

  if (error || !session) {
    const notMember = error instanceof SessionError && error.code === 'not_member';
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-background px-6">
        <Text className="text-lg font-bold text-text">
          {notMember ? '이 모임 멤버가 아니에요' : sessionErrorMessage(error)}
        </Text>
        <View className="w-full max-w-xs">
          {notMember ? (
            <Button label="홈으로" onPress={() => router.replace('/')} />
          ) : (
            <Button label="다시 시도" variant="secondary" onPress={() => retry()} />
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <Header session={session} onBack={() => router.replace(`/groups/${session.groupId}` as any)} />
      {session.status === 'open' ? (
        <CandidateStage session={session} onRestrictions={() => router.push('/restrictions' as any)} />
      ) : session.status === 'voting' ? (
        <VotingStage session={session} />
      ) : (
        <ResultStage
          session={session}
          spin={sawVoting}
          onGroup={() => router.replace(`/groups/${session.groupId}` as any)}
        />
      )}
    </SafeAreaView>
  );
}

const STEPS = [
  { status: 'open', label: '후보' },
  { status: 'voting', label: '투표' },
  { status: 'done', label: '결과' },
] as const;

function Header({ session, onBack }: { session: SessionView; onBack: () => void }) {
  return (
    <View className="gap-4 px-5 pb-2 pt-3">
      <View className="flex-row items-center justify-between">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="모임으로"
          onPress={onBack}
          className="rounded-full bg-surface px-4 py-2 active:opacity-70">
          <Text className="text-sm font-semibold text-text">모임으로</Text>
        </Pressable>
        <Text className="flex-1 px-3 text-right text-base font-bold text-text" numberOfLines={1}>
          {session.groupName}
        </Text>
      </View>
      <View className="flex-row items-center gap-2">
        {STEPS.map((step, i) => (
          <View key={step.status} className="flex-row items-center gap-2">
            {i > 0 ? <View className="h-px w-4 bg-surface-strong" /> : null}
            <Text
              className={`text-sm ${
                session.status === step.status ? 'font-bold text-text' : 'text-muted'
              }`}>
              {step.label}
            </Text>
          </View>
        ))}
      </View>
      <Participants participants={session.participants} showVoted={session.status === 'voting'} />
    </View>
  );
}

// 참여자 이름 첫 글자 동그라미. 투표 중에는 투표한 사람만 검게 칠한다 (무엇을 찍었는지는 없다)
function Participants({
  participants,
  showVoted,
}: {
  participants: Participant[];
  showVoted: boolean;
}) {
  return (
    <View className="flex-row flex-wrap items-center gap-2">
      {participants.map((p) => {
        const on = showVoted && p.voted;
        return (
          <View
            key={p.userId}
            accessibilityLabel={`${p.displayName}${on ? ' 투표함' : ''}`}
            className={`h-9 w-9 items-center justify-center rounded-full ${
              on ? 'bg-text' : 'bg-surface-strong'
            }`}>
            <Text className={`text-sm font-bold ${on ? 'text-on-primary' : 'text-text'}`}>
              {Array.from(p.displayName)[0] ?? ''}
            </Text>
          </View>
        );
      })}
      <Text className="text-sm text-muted">{participants.length}명 참여</Text>
    </View>
  );
}

// 4-9 후보 올리기, 4-10 투표 시작
function CandidateStage({
  session,
  onRestrictions,
}: {
  session: SessionView;
  onRestrictions: () => void;
}) {
  const { foods } = useFoods();
  const { add, pitch, remove, open } = useSessionActions(session.id);
  const alive = session.candidates.filter((c) => !c.vetoed).length;
  const busy = add.isPending || pitch.isPending || remove.isPending;
  const actionError = add.error ?? pitch.error ?? remove.error;

  return (
    <View className="flex-1">
      <ScrollView contentContainerClassName="gap-5 px-5 pb-40 pt-2">
        <View className="flex-row items-end justify-between">
          <View className="flex-1 gap-1">
            <Text className="text-2xl font-bold text-text">뭐 먹고 싶어요?</Text>
            <Text className="text-sm text-muted">먹고 싶은 음식을 올리고 한 줄 어필을 붙여요</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="못 먹는 것"
            onPress={onRestrictions}
            className="rounded-full bg-surface px-4 py-2 active:opacity-70">
            <Text className="text-sm font-semibold text-text">못 먹는 것</Text>
          </Pressable>
        </View>

        <FoodSearch
          foods={foods}
          excludeIds={session.candidates.map((c) => c.foodId)}
          onPick={(food) => add.mutate(food.id)}
          disabled={busy}
          error={actionError ? sessionErrorMessage(actionError) : null}
        />

        <View className="gap-3">
          <Text className="text-base font-bold text-text">후보 {session.candidates.length}개</Text>
          {session.candidates.length === 0 ? (
            <Text className="text-sm text-muted">아직 올라온 후보가 없어요</Text>
          ) : (
            session.candidates.map((c) => (
              <CandidateCard
                key={c.foodId}
                candidate={c}
                busy={busy}
                onSavePitch={c.isMine ? (text) => pitch.mutate({ foodId: c.foodId, text }) : undefined}
                onRemove={c.isMine ? () => remove.mutate(c.foodId) : undefined}
              />
            ))
          )}
        </View>
      </ScrollView>

      <BottomBar>
        {session.isHost ? (
          <>
            <Button
              label="투표 시작"
              onPress={() => open.mutate()}
              disabled={alive === 0}
              loading={open.isPending}
            />
            {alive === 0 ? (
              <Text className="text-center text-sm text-muted">후보를 하나 이상 올려주세요</Text>
            ) : open.error ? (
              <Text className="text-center text-sm text-danger">{sessionErrorMessage(open.error)}</Text>
            ) : null}
          </>
        ) : (
          <Text className="text-center text-base font-semibold text-muted">
            방장이 투표를 열면 시작돼요
          </Text>
        )}
      </BottomBar>
    </View>
  );
}

// 4-11 익명 투표. 투표 중에는 음식별 표 수를 보여주지 않는다
function VotingStage({ session }: { session: SessionView }) {
  const { vote, spin } = useSessionActions(session.id);
  const votedCount = session.participants.filter((p) => p.voted).length;
  const total = session.participants.length;
  const ratio = total === 0 ? 0 : votedCount / total;

  return (
    <View className="flex-1">
      <ScrollView contentContainerClassName="gap-5 px-5 pb-40 pt-2">
        <View className="gap-1">
          <Text className="text-2xl font-bold text-text">골라 주세요</Text>
          <Text className="text-sm text-muted">
            최대 {MAX_VOTES_PER_PERSON}개까지. 누가 뭘 골랐는지는 아무도 몰라요
          </Text>
        </View>

        <View className="gap-2 rounded-2xl bg-surface p-4">
          <View className="flex-row justify-between">
            <Text className="text-sm font-semibold text-text">
              {votedCount}/{total}명 투표했어요
            </Text>
            <Text className="text-sm text-muted">
              내 표 {session.myVotes.length}/{MAX_VOTES_PER_PERSON}
            </Text>
          </View>
          <View className="h-2 overflow-hidden rounded-full bg-surface-strong">
            <View className="h-2 rounded-full bg-text" style={{ width: `${ratio * 100}%` }} />
          </View>
        </View>

        {vote.error ? (
          <Text className="text-sm font-semibold text-danger">{sessionErrorMessage(vote.error)}</Text>
        ) : null}

        <View className="gap-3">
          {session.candidates.map((c) => (
            <CandidateCard
              key={c.foodId}
              candidate={c}
              voted={session.myVotes.includes(c.foodId)}
              busy={vote.isPending}
              onVote={() => vote.mutate(c.foodId)}
            />
          ))}
        </View>
      </ScrollView>

      <BottomBar>
        {session.isHost ? (
          <>
            <Button label="돌리기" onPress={() => spin.mutate()} loading={spin.isPending} />
            {spin.error ? (
              <Text className="text-center text-sm text-danger">{sessionErrorMessage(spin.error)}</Text>
            ) : (
              <Text className="text-center text-sm text-muted">
                표가 많을수록 원판 조각이 커져요
              </Text>
            )}
          </>
        ) : (
          <Text className="text-center text-base font-semibold text-muted">
            방장이 돌리면 결과가 나와요
          </Text>
        )}
      </BottomBar>
    </View>
  );
}

// 4-12 룰렛, 4-13 식사 기록. 결과는 서버가 정했고, 이 화면은 같은 조각에 멈추는 원판을 그린다
function ResultStage({
  session,
  spin,
  onGroup,
}: {
  session: SessionView;
  spin: boolean;
  onGroup: () => void;
}) {
  const { counts, error } = useVoteCounts(session.id, true);
  // 방금 끝난 판이면(이 화면에서 투표를 봤거나, 결과가 몇 초 전에 나왔으면) 원판을 돌린다
  const [animate] = useState(
    () =>
      spin ||
      (session.decidedAt !== null &&
        Date.now() - Date.parse(session.decidedAt) < ROULETTE_RESULT_FALLBACK_MS)
  );
  const [revealed, setRevealed] = useState(!animate);

  const names = new Map(session.candidates.map((c) => [c.foodId, c.foodName]));
  const winner = session.decidedFoodId === null ? '' : (names.get(session.decidedFoodId) ?? '');
  const slices = counts
    ? rouletteSlices(counts).map((s) => ({ ...s, name: names.get(s.foodId) ?? '' }))
    : [];

  return (
    <View className="flex-1">
      <ScrollView contentContainerClassName="items-center gap-6 px-5 pb-40 pt-4">
        {error ? (
          <Text className="text-sm text-danger">{sessionErrorMessage(error)}</Text>
        ) : slices.length > 0 && session.decidedFoodId !== null ? (
          <Roulette
            slices={slices}
            resultFoodId={session.decidedFoodId}
            spin={animate}
            onDone={() => setRevealed(true)}
          />
        ) : (
          <ActivityIndicator color={colors.primary} accessibilityLabel="결과를 불러오는 중" />
        )}

        <View className="items-center gap-2" style={{ opacity: revealed ? 1 : 0 }}>
          <Text className="text-base text-muted">오늘은</Text>
          <Text className="text-center text-4xl font-bold text-primary">{winner}</Text>
          <Text className="text-sm text-muted">모임 식사 기록에 남겼어요</Text>
        </View>
      </ScrollView>

      <BottomBar>
        <Button label="모임으로" variant="secondary" onPress={onGroup} />
      </BottomBar>
    </View>
  );
}

// 화면 아래 고정 버튼 자리. SafeAreaView는 className의 여백을 덮어써서, 아래 여백만 기기 값에 더한다
function BottomBar({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="absolute bottom-0 left-0 right-0 gap-2 bg-background px-5 pt-3"
      style={{ paddingBottom: insets.bottom + 16 }}>
      {children}
    </View>
  );
}
