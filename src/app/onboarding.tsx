import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Button } from '@/components/button';
import { IconButton } from '@/components/icon';
import { TextField } from '@/components/text-field';
import colors from '@/constants/colors.json';
import { DISPLAY_NAME_MAX, HANDLE_MAX, QUIZ_LENGTH } from '@/constants';
import { QUIZ, type QuizAnswer } from '@/constants/quiz';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import {
  type Axes,
  isValidHandle,
  profileErrorMessage,
  typeLines,
  useMyProfile,
  useSaveProfile,
} from '@/hooks/use-profile';

type Step = 'name' | 'quiz' | 'result' | 'handle';

// 온보딩 (spec.md 4-14). 이름 → 8문항 → 네 글자 → 아이디(건너뛰기) → 홈.
// 단계마다 save_my_profile로 저장해서 중간에 나가도 그때까지는 남는다
export default function OnboardingScreen() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const profile = useMyProfile();
  const save = useSaveProfile();

  const [chosenStep, setStep] = useState<Step | null>(null);
  const [name, setName] = useState('');
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [axes, setAxes] = useState<Axes | null>(null);
  const [handle, setHandle] = useState('');
  const [handleError, setHandleError] = useState<string | null>(null);
  // 마지막 문항 저장이 실패하면 같은 답으로 다시 보낸다
  const [lastPick, setLastPick] = useState<QuizAnswer | null>(null);

  // 이름이 이미 있으면(링크로 들어왔거나 이름 단계에서 저장했으면) 이름 단계를 건너뛴다
  const step: Step | null =
    chosenStep ?? (profile.isPending ? null : profile.data?.displayName ? 'quiz' : 'name');

  const finish = () => router.replace((from === 'profile' ? '/profile' : '/') as any);

  if (profile.isError) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-background px-6">
        <Text className="text-lg font-bold text-text">연결할 수 없어요</Text>
        <View className="w-full max-w-xs">
          <Button label="다시 시도" variant="secondary" onPress={() => profile.refetch()} />
        </View>
      </SafeAreaView>
    );
  }

  if (step === null) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={colors.primary} accessibilityLabel="불러오는 중" />
      </SafeAreaView>
    );
  }

  const saveError = save.error ? profileErrorMessage(save.error) : null;

  if (step === 'name') {
    const trimmed = name.trim();
    const submit = () => {
      if (!trimmed || save.isPending) return;
      save.mutate({ displayName: trimmed }, { onSuccess: () => setStep('quiz') });
    };
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 gap-8 px-5 pt-16">
          <Text className="text-3xl font-extrabold tracking-tight text-text">뭐라고 부를까요?</Text>
          <TextField
            label="이름"
            placeholder="예: 홍길동"
            value={name}
            onChangeText={(t) => {
              setName(t);
              save.reset();
            }}
            maxLength={DISPLAY_NAME_MAX}
            autoFocus
            onSubmitEditing={submit}
            error={saveError}
          />
        </View>
        <View className="px-5 pb-8">
          <Button label="다음" onPress={submit} disabled={!trimmed} loading={save.isPending} />
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'quiz') {
    const i = answers.length;
    const q = QUIZ[i];
    const pick = (a: QuizAnswer) => {
      if (save.isPending) return;
      const next = [...answers, a];
      if (next.length < QUIZ_LENGTH) {
        setAnswers(next);
        return;
      }
      setLastPick(a);
      save.mutate(
        { quizAnswers: next },
        {
          onSuccess: (r) => {
            setAnswers(next);
            setAxes(r.axes);
            setStep('result');
          },
        }
      );
    };
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-row items-center gap-3 px-5 py-3">
          {i > 0 ? (
            <IconButton name="back" label="이전 문항" onPress={() => setAnswers(answers.slice(0, -1))} />
          ) : (
            <View className="h-12 w-12" />
          )}
          {/* 진행 막대 높이 12 (docs/design.md 4절 5번) */}
          <View
            accessibilityLabel={`${i + 1}/${QUIZ_LENGTH}`}
            className="h-3 flex-1 overflow-hidden rounded-full bg-surface-strong"
          >
            <View
              className="h-3 rounded-full bg-text"
              style={{ width: `${((i + 1) / QUIZ_LENGTH) * 100}%` }}
            />
          </View>
          <Text className="w-12 text-right text-sm font-semibold text-muted">
            {i + 1}/{QUIZ_LENGTH}
          </Text>
        </View>
        <View className="flex-1 justify-center gap-8 px-5 pb-16">
          <Text className="text-3xl font-extrabold leading-tight tracking-tight text-text">
            {q.situation}
          </Text>
          {/* 두 답은 같은 크기의 칸 (4절 2번) */}
          <View className="gap-3">
            {(['A', 'B'] as const).map((a) => (
              <Pressable
                key={a}
                accessibilityRole="button"
                accessibilityLabel={a === 'A' ? q.a : q.b}
                disabled={save.isPending}
                onPress={() => pick(a)}
                className="h-20 justify-center rounded-3xl bg-surface px-6 active:bg-surface-strong disabled:opacity-50"
              >
                <Text className="text-xl font-bold text-text">{a === 'A' ? q.a : q.b}</Text>
              </Pressable>
            ))}
          </View>
          {save.isPending ? (
            <ActivityIndicator color={colors.primary} accessibilityLabel="저장하는 중" />
          ) : null}
          {saveError && lastPick ? (
            <View className="gap-2">
              <Text className="text-sm font-semibold text-danger">{saveError}</Text>
              <Button label="다시 시도" variant="secondary" onPress={() => pick(lastPick)} />
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'result' && axes) {
    return (
      <TypeReveal
        axes={axes}
        onNext={() => {
          save.reset();
          setStep('handle');
        }}
        onRetry={() => {
          save.reset();
          setAnswers([]);
          setAxes(null);
          setStep('quiz');
        }}
      />
    );
  }

  // 아이디 (건너뛰기 가능)
  const trimmedHandle = handle.trim();
  const submitHandle = () => {
    if (save.isPending) return;
    if (!isValidHandle(trimmedHandle)) {
      setHandleError('영어 소문자, 숫자, 밑줄로 3~16자');
      return;
    }
    save.mutate({ handle: trimmedHandle }, { onSuccess: finish });
  };
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 gap-8 px-5 pt-16">
        <Text className="text-3xl font-extrabold tracking-tight text-text">아이디를 정해요</Text>
        <TextField
          label="아이디"
          placeholder="영어 소문자, 숫자, 밑줄 3~16자"
          value={handle}
          onChangeText={(t) => {
            setHandle(t);
            setHandleError(null);
            save.reset();
          }}
          maxLength={HANDLE_MAX}
          autoCapitalize="none"
          autoFocus
          onSubmitEditing={submitHandle}
          error={handleError ?? saveError}
        />
      </View>
      <View className="flex-row gap-2 px-5 pb-8">
        <View className="flex-1">
          <Button label="건너뛰기" variant="secondary" onPress={finish} disabled={save.isPending} />
        </View>
        <View className="flex-1">
          <Button
            label="시작하기"
            onPress={submitHandle}
            disabled={!trimmedHandle}
            loading={save.isPending}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const REVEAL_GAP_MS = 120;
const REVEAL_MS = 140;

// 순간 2 (docs/design.md). 검정 바탕, 2×2 칸에 한 글자씩 0.12초 간격으로 아래에서 12만큼 올라오며 나타난다.
// 네 번째 칸이 나올 때 진동 한 번. 동작 줄이기면 움직임 없이 마지막 모습만
function TypeReveal({ axes, onNext, onRetry }: { axes: Axes; onNext: () => void; onRetry: () => void }) {
  const reduce = useReduceMotion();
  const lines = typeLines(axes);
  const [anims] = useState(() => [0, 1, 2, 3].map(() => new Animated.Value(0)));

  useEffect(() => {
    if (reduce) {
      anims.forEach((a) => a.setValue(1));
      return;
    }
    const run = Animated.stagger(
      REVEAL_GAP_MS,
      anims.map((a) =>
        Animated.timing(a, {
          toValue: 1,
          duration: REVEAL_MS,
          useNativeDriver: Platform.OS !== 'web',
        })
      )
    );
    run.start();
    const t = setTimeout(() => {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    }, REVEAL_GAP_MS * 3);
    return () => {
      run.stop();
      clearTimeout(t);
    };
  }, [anims, reduce]);

  return (
    <SafeAreaView className="relative flex-1">
      {/* 주황 그라데이션 배경: food-7 -> primary -> food-5 */}
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id="typeRevealGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={colors['food-7']} stopOpacity="1" />
            <Stop offset="55%" stopColor={colors.primary} stopOpacity="1" />
            <Stop offset="100%" stopColor={colors['food-5']} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#typeRevealGrad)" />
      </Svg>

      <View className="flex-1 justify-center gap-8 px-5">
        <Text className="text-lg font-bold text-on-primary" accessibilityRole="header">
          나의 밥BTI
        </Text>
        <View
          accessibilityLabel={`네 글자 ${lines.map((l) => l.letter).join('')}`}
          className="flex-row flex-wrap justify-between gap-y-3"
        >
          {lines.map((l, i) => (
            <Animated.View
              key={l.letter}
              style={{
                width: '48.5%',
                opacity: anims[i],
                transform: [
                  {
                    translateY: anims[i].interpolate({
                      inputRange: [0, 1],
                      outputRange: [12, 0],
                    }),
                  },
                ],
              }}
            >
              <View className="aspect-square items-center justify-center gap-1 rounded-3xl bg-food-8 shadow-sm">
                <Text className="text-8xl font-extrabold text-on-ink">{l.letter}</Text>
                <Text className="text-base font-semibold text-on-ink opacity-80">{l.line}</Text>
              </View>
            </Animated.View>
          ))}
        </View>
      </View>
      <View className="gap-2.5 px-5 pb-8">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="아이디 정하고 시작하기"
          onPress={onNext}
          className="h-14 items-center justify-center rounded-full bg-on-primary px-6 active:opacity-80"
        >
          <Text className="text-lg font-extrabold text-primary">아이디 정하고 시작하기</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="다시 하기"
          onPress={onRetry}
          className="h-14 items-center justify-center rounded-full bg-ink px-6 active:opacity-80"
        >
          <Text className="text-base font-bold text-on-ink">다시 하기</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
