import { useLocalSearchParams, useRouter } from 'expo-router';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { CandidateCard } from '@/components/candidate-card';
import { FoodSearch } from '@/components/food-search';
import { HeadcountStepper } from '@/components/headcount-stepper';
import { Icon, IconButton } from '@/components/icon';
import { type Point, ResultMoment } from '@/components/result-moment';
import { Roulette } from '@/components/roulette';
import colors from '@/constants/colors.json';
import { cantEatNotice } from '@/constants/restrictions';
import {
  GROUP_FAVORITES_MAX,
  MAX_VOTES_PER_PERSON,
  QUICK_FILL_COUNT,
  RECENT_EATEN_DAYS,
  ROULETTE_RESULT_FALLBACK_MS,
} from '@/constants';
import {
  rouletteSlices,
  SessionError,
  sessionErrorMessage,
  type SessionView,
  eatenNote,
  groupFavorites,
  quickFillPicks,
  useFoodHints,
  useFoods,
  useSession,
  useSessionActions,
  useVoteCounts,
  votingReady,
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
  // 원판이 멈추면 결과 순간을 화면 전체에 덮는다. from이 null이면 움직임 없이 (docs/design.md 순간 1)
  const [moment, setMoment] = useState<{ from: Point | null } | null>(null);
  // 결과 순간은 이 화면 안에 덮인다. 노트북에서는 화면이 가운데 폭 480 안에 있어서, 원판 위치(창 기준)를 이 화면 기준으로 바꿔 준다
  const rootRef = useRef<View>(null);
  const showMoment = (from: Point | null) => {
    const root = rootRef.current;
    if (!from || !root) return setMoment({ from });
    root.measureInWindow((rx, ry) => setMoment({ from: { x: from.x - rx, y: from.y - ry } }));
  };

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

  const toGroup = () => router.replace(`/groups/${session.groupId}` as any);

  return (
    <View ref={rootRef} collapsable={false} className="flex-1 bg-background">
      <SafeAreaView className="flex-1 bg-background" edges={['top']}>
        <Header session={session} onBack={toGroup} />
        {session.status === 'open' ? (
          <CandidateStage session={session} onRestrictions={() => router.push('/restrictions' as any)} />
        ) : session.status === 'voting' ? (
          <VotingStage session={session} />
        ) : (
          <ResultStage
            session={session}
            spin={sawVoting}
            onGroup={toGroup}
            onReveal={showMoment}
          />
        )}
      </SafeAreaView>
      {session.status === 'done' && moment ? (
        <ResultMoment session={session} from={moment.from} onGroup={toGroup} />
      ) : null}
    </View>
  );
}

const STEPS = [
  { status: 'open', label: '후보' },
  { status: 'voting', label: '투표' },
  { status: 'done', label: '결과' },
] as const;

function Header({ session, onBack }: { session: SessionView; onBack: () => void }) {
  const current = STEPS.findIndex((step) => step.status === session.status);
  return (
    <View className="gap-4 px-5 pb-2 pt-3">
      <View className="flex-row items-center gap-3">
        <IconButton name="back" label="모임으로" onPress={onBack} />
        <Text className="flex-1 text-lg font-extrabold text-text" numberOfLines={1}>
          {session.groupName}
        </Text>
      </View>
      {/* 한 판의 세 단계. 같은 크기의 칸 셋이고 지금 단계만 검정으로 채운다. 지나온 단계는 진한 회색 */}
      <View className="flex-row gap-2">
        {STEPS.map((step, i) => (
          <View
            key={step.status}
            className={`h-10 flex-1 items-center justify-center rounded-full ${
              i === current ? 'bg-ink' : i < current ? 'bg-surface-strong' : 'bg-surface'
            }`}>
            <Text
              className={`text-sm font-bold ${
                i === current ? 'text-on-ink' : i < current ? 'text-text' : 'text-muted'
              }`}>
              {step.label}
            </Text>
          </View>
        ))}
      </View>
      <Participants session={session} />
    </View>
  );
}

// 참여자 이름 첫 글자 동그라미. 투표 중에는 투표한 사람만 검게 칠한다 (무엇을 찍었는지는 없다).
// 오른쪽은 몇 명이서 먹는지. 방장은 여기서 바로 바꾼다 (4-6, 4-12)
function Participants({ session }: { session: SessionView }) {
  const { headcount } = useSessionActions(session.id);
  const showVoted = session.status === 'voting';
  const participants = session.participants;
  const expected = session.expectedCount;
  // 결과가 나온 판은 인원수를 바꿀 수 없으니 숫자 고르기를 보이지 않는다
  const canEdit = session.isHost && session.status !== 'done';
  return (
    <View className="flex-row items-center gap-3">
      <View className="flex-1 flex-row flex-wrap items-center gap-2">
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
        {expected === null || !canEdit ? (
          <Text className="text-sm text-muted">
            {expected === null ? `${participants.length}명 참여` : `${expected}명이서 먹어요`}
          </Text>
        ) : null}
      </View>
      {expected !== null && canEdit ? (
        <View className="rounded-full bg-surface p-1">
          <HeadcountStepper
            value={expected}
            onChange={(n) => headcount.mutate(n)}
            disabled={headcount.isPending}
          />
        </View>
      ) : null}
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
  const { add, addCustom, pitch, remove, open } = useSessionActions(session.id);
  // 4-20 식사 기록과 못 먹는 것. 참여자 수가 바뀌면 다시 읽는다
  const hints = useFoodHints(session.id, `${session.participants.length}`);
  const hintOf = new Map(hints.map((h) => [h.foodId, h]));
  const candidateIds = session.candidates.map((c) => c.foodId);
  const favorites = groupFavorites(hints, candidateIds, GROUP_FAVORITES_MAX);
  const foodName = new Map(foods.map((f) => [f.id, f.name]));
  // 검색칸이 비었을 때 보이는 추천에서 못 먹는 사람이 있는 음식은 뒤로 보낸다
  const searchFoods = [...foods].sort(
    (a, b) => Number(hintOf.get(a.id)?.blocked ?? false) - Number(hintOf.get(b.id)?.blocked ?? false)
  );
  const [filling, setFilling] = useState(false);
  const quickFill = async () => {
    const picks = quickFillPicks(hints, candidateIds, QUICK_FILL_COUNT, RECENT_EATEN_DAYS);
    setFilling(true);
    try {
      for (const id of picks) await add.mutateAsync(id);
    } catch {
      // 오류 문구는 아래 검색칸 오류 자리에 보인다
    } finally {
      setFilling(false);
    }
  };
  // 0010부터 못 먹는 사람이 있는 후보도 남는다. 후보가 하나라도 있으면 투표를 연다
  const alive = session.candidates.length;
  const busy = filling || add.isPending || addCustom.isPending || pitch.isPending || remove.isPending;
  const actionError = add.error ?? addCustom.error ?? pitch.error ?? remove.error;

  return (
    <View className="flex-1">
      <ScrollView contentContainerClassName="gap-5 px-5 pb-40 pt-2">
        <View className="flex-row items-end justify-between">
          <Text className="flex-1 text-3xl font-extrabold tracking-tight text-text">뭐 먹고 싶어요?</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="못 먹는 것"
            onPress={onRestrictions}
            className="rounded-full bg-surface px-4 py-2 active:opacity-70">
            <Text className="text-sm font-semibold text-text">못 먹는 것</Text>
          </Pressable>
        </View>

        {/* 다 같이 딱히 먹고 싶은 게 없을 때 (#44 인터뷰 세 명, 설문 76.9%). 앱이 정하지 않고 후보만 채운다. 정하는 건 투표와 룰렛 (4-20) */}
        {session.candidates.length === 0 && hints.length > 0 ? (
          <Button
            label="모두 먹을 수 있는 메뉴 3개 채우기"
            variant="secondary"
            onPress={quickFill}
            loading={filling}
            disabled={busy}
          />
        ) : null}

        {favorites.length > 0 ? (
          <View className="gap-2">
            <Text className="text-sm font-bold text-text">이 모임 단골</Text>
            <View className="flex-row flex-wrap gap-2">
              {favorites.map((h) => (
                <Pressable
                  key={h.foodId}
                  accessibilityRole="button"
                  accessibilityLabel={`${foodName.get(h.foodId) ?? ''} 후보로 올리기, ${h.eatenCount}번 먹음`}
                  disabled={busy}
                  onPress={() => add.mutate(h.foodId)}
                  className="h-11 flex-row items-center gap-2 rounded-full bg-ink px-4 active:opacity-80 disabled:opacity-50">
                  <Text className="text-base font-bold text-on-ink">{foodName.get(h.foodId) ?? ''}</Text>
                  <Text className="text-sm font-semibold text-on-ink opacity-60">{h.eatenCount}번</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        <FoodSearch
          foods={searchFoods}
          excludeIds={session.candidates.map((c) => c.foodId)}
          onPick={(food) => add.mutate(food.id)}
          onCustom={(name) => addCustom.mutate(name)}
          disabled={busy}
          error={actionError ? sessionErrorMessage(actionError) : null}
        />

        <View className="gap-3">
          <Text className="text-xl font-extrabold text-text">후보 {session.candidates.length}개</Text>
          {session.candidates.map((c) => (
              <CandidateCard
                key={c.foodId}
                candidate={c}
                busy={busy}
                eatenNote={eatenNote(hintOf.get(c.foodId)?.lastEatenAt ?? null, RECENT_EATEN_DAYS)}
                onSavePitch={c.isMine ? (text) => pitch.mutate({ foodId: c.foodId, text }) : undefined}
                onRemove={c.isMine ? () => remove.mutate(c.foodId) : undefined}
              />
            ))}
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
            {session.hostName ? `방장 ${session.hostName} 님이 투표를 열면 시작돼요` : '방장이 투표를 열면 시작돼요'}
          </Text>
        )}
      </BottomBar>
    </View>
  );
}

// 4-11 익명 투표. 투표 중에는 음식별 표 수를 보여주지 않는다
function VotingStage({ session }: { session: SessionView }) {
  const { vote, spin, anyOk } = useSessionActions(session.id);
  const notice = cantEatNotice(session.cantEat.tags, session.cantEat.foods);
  const votedCount = session.participants.filter((p) => p.voted).length;
  // 몇 명이서 먹는지 정한 판은 그 수가 기준이다. 예전 판은 들어온 사람 수
  const total = session.expectedCount ?? session.participants.length;
  const ratio = total === 0 ? 0 : Math.min(1, votedCount / total);
  const ready = votingReady(session);
  const left = Math.max(0, total - votedCount);

  return (
    <View className="flex-1">
      <ScrollView contentContainerClassName="gap-5 px-5 pb-40 pt-2">
        <View className="gap-1">
          <Text className="text-3xl font-extrabold tracking-tight text-text">골라 주세요</Text>
          {/* 몇 개까지인지는 아래 "내 표 0/2"가 보인다 */}
          <Text className="text-base text-muted">누가 뭘 골랐는지는 아무도 몰라요</Text>
        </View>

        <View className="gap-2 rounded-2xl bg-surface p-4">
          <View className="flex-row justify-between">
            <Text className="text-sm font-semibold text-text">
              {votedCount}/{total}명 골랐어요
            </Text>
            <Text className="text-sm text-muted">
              내 표 {session.myVotes.length}/{MAX_VOTES_PER_PERSON}
            </Text>
          </View>
          <View className="h-3 overflow-hidden rounded-full bg-surface-strong">
            <View className="h-3 rounded-full bg-text" style={{ width: `${ratio * 100}%` }} />
          </View>
        </View>

        {/* 이 판 후보에 걸리는 못 먹는 것. 빼지 않고 알린다. 누가 적었는지는 없다 (0010) */}
        {notice.length > 0 ? (
          <View accessibilityRole="alert" className="gap-1 rounded-3xl bg-ink p-5">
            {notice.map((line) => (
              <Text key={line} className="text-lg font-extrabold text-on-ink">
                {line}
              </Text>
            ))}
          </View>
        ) : null}

        {vote.error ?? anyOk.error ? (
          <Text className="text-sm font-semibold text-danger">
            {sessionErrorMessage(vote.error ?? anyOk.error)}
          </Text>
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
          {/* 아무거나 먹어도 되는 사람은 고르지 않고 투표를 마친다 (#44 인터뷰 2) */}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: session.myAnyOk, disabled: anyOk.isPending }}
            accessibilityLabel={session.myAnyOk ? '아무거나 괜찮아요 취소' : '아무거나 괜찮아요'}
            disabled={anyOk.isPending}
            onPress={() => anyOk.mutate()}
            className={`h-14 flex-row items-center justify-center gap-2 rounded-full active:opacity-80 ${
              session.myAnyOk ? 'bg-ink' : 'bg-surface'
            }`}>
            {session.myAnyOk ? <Icon name="check" color="on-ink" /> : null}
            <Text className={`text-lg font-bold ${session.myAnyOk ? 'text-on-ink' : 'text-text'}`}>
              아무거나 괜찮아요
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <BottomBar>
        {session.isHost ? (
          <>
            {/* 몇 명이서 먹는지 정했으면 그 수만큼 골라야 눌린다 (4-12) */}
            <Button
              label="돌리기"
              onPress={() => spin.mutate()}
              disabled={!ready}
              loading={spin.isPending}
            />
            {!ready ? (
              <Text className="text-center text-sm text-muted">{left}명 더 고르면 돌릴 수 있어요</Text>
            ) : spin.error ? (
              <Text className="text-center text-sm text-danger">{sessionErrorMessage(spin.error)}</Text>
            ) : null}
          </>
        ) : (
          <Text className="text-center text-base font-semibold text-muted">
            {session.hostName ? `방장 ${session.hostName} 님이 돌리면 결과가 나와요` : '방장이 돌리면 결과가 나와요'}
          </Text>
        )}
      </BottomBar>
    </View>
  );
}

// 4-12 룰렛, 4-13 식사 기록. 결과는 서버가 정했고, 이 화면은 같은 조각에 멈추는 원판을 그린다.
// 멈추면 onReveal로 원판 가운데 위치를 넘기고, 화면은 그 자리에서 결과 순간을 띄운다
function ResultStage({
  session,
  spin,
  onGroup,
  onReveal,
}: {
  session: SessionView;
  spin: boolean;
  onGroup: () => void;
  onReveal: (from: Point | null) => void;
}) {
  const { counts, error } = useVoteCounts(session.id, true);
  // 방금 끝난 판이면(이 화면에서 투표를 봤거나, 결과가 몇 초 전에 나왔으면) 원판을 돌린다
  const [animate] = useState(
    () =>
      spin ||
      (session.decidedAt !== null &&
        Date.now() - Date.parse(session.decidedAt) < ROULETTE_RESULT_FALLBACK_MS)
  );
  const wheelRef = useRef<View>(null);

  // 이미 끝난 판을 다시 열면 원판을 돌리지 않고 결과 순간을 바로 보인다
  useEffect(() => {
    if (!animate) onReveal(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reveal = () => {
    const node = wheelRef.current;
    if (!node) return onReveal(null);
    node.measureInWindow((x, y, w, h) => onReveal({ x: x + w / 2, y: y + h / 2 }));
  };

  const names = new Map(session.candidates.map((c) => [c.foodId, c.foodName]));
  const slices = counts
    ? rouletteSlices(counts).map((s) => ({ ...s, name: names.get(s.foodId) ?? '' }))
    : [];

  return (
    <View className="flex-1">
      <ScrollView contentContainerClassName="items-center gap-6 px-5 pb-40 pt-4">
        {error ? (
          <Text className="text-sm text-danger">{sessionErrorMessage(error)}</Text>
        ) : slices.length > 0 && session.decidedFoodId !== null ? (
          <View ref={wheelRef} collapsable={false}>
            <Roulette
              slices={slices}
              resultFoodId={session.decidedFoodId}
              spin={animate}
              onDone={reveal}
            />
          </View>
        ) : (
          <ActivityIndicator color={colors.primary} accessibilityLabel="결과를 불러오는 중" />
        )}

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
