import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';

import { foodColorValues } from '@/components/food-dot';
import colors from '@/constants/colors.json';
import {
  ROULETTE_LABEL_MAX,
  ROULETTE_RESULT_FALLBACK_MS,
  ROULETTE_SPIN_MS,
  ROULETTE_TURNS,
} from '@/constants';

export type RouletteSlice = { foodId: number; name: string; weight: number };

type Arc = RouletteSlice & { start: number; end: number };

// 조각 각도. 위쪽(12시)을 0도로 시계 방향. 크기는 표 수에 비례한다 (4-12 "보이는 것과 확률이 같아야 한다")
export function sliceArcs(slices: RouletteSlice[]): Arc[] {
  const total = slices.reduce((sum, s) => sum + s.weight, 0);
  let start = 0;
  return slices.map((s) => {
    const end = start + (360 * s.weight) / total;
    const arc = { ...s, start, end };
    start = end;
    return arc;
  });
}

// 결과 조각의 가운데가 위쪽 바늘에 오도록 몇 도 돌릴지. 앞에 ROULETTE_TURNS바퀴를 더 돈다
export function finalRotation(arcs: Arc[], resultFoodId: number): number {
  const target = arcs.find((a) => a.foodId === resultFoodId);
  const center = target ? (target.start + target.end) / 2 : 0;
  return 360 * ROULETTE_TURNS + ((360 - center) % 360);
}

// 7글자가 넘으면 자른다 (4-12). 한글 한 자를 1자로 센다
export function rouletteLabel(name: string): string {
  const chars = Array.from(name);
  return chars.length > ROULETTE_LABEL_MAX ? `${chars.slice(0, ROULETTE_LABEL_MAX).join('')}…` : name;
}

// 바늘 아래에 있는 조각. 돌린 각도 r이면 원래 (360 - r) 위치가 위쪽에 온다
export function sliceAt(arcs: Arc[], rotation: number): number {
  const a = (((360 - rotation) % 360) + 360) % 360;
  const i = arcs.findIndex((s) => a >= s.start && a < s.end);
  return i === -1 ? arcs.length - 1 : i;
}

// 원판 지름. 좁은 화면에서는 양옆 여백 20씩을 남기고 줄인다
const MAX_SIZE = 280;

function point(c: number, angle: number, radius: number) {
  const rad = (angle * Math.PI) / 180;
  return { x: c + radius * Math.sin(rad), y: c - radius * Math.cos(rad) };
}

function slicePath(c: number, r: number, start: number, end: number) {
  const p0 = point(c, start, r);
  const p1 = point(c, end, r);
  const large = end - start > 180 ? 1 : 0;
  return `M ${c} ${c} L ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} 1 ${p1.x} ${p1.y} Z`;
}

function haptic(kind: 'tick' | 'done') {
  // 진동이 없는 기기나 브라우저면 조용히 넘어간다
  const run =
    kind === 'tick'
      ? Haptics.selectionAsync()
      : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  run.catch(() => {});
}

type RouletteProps = {
  slices: RouletteSlice[];
  resultFoodId: number;
  // true면 돌고 나서 멈춘다. false면 결과 자리에 멈춘 채로 그린다 (이미 끝난 판을 다시 열 때)
  spin: boolean;
  onDone?: () => void;
  // food는 음식 색으로 칠한 원판, onPrimary는 결과 순간의 주황 바탕 위 흰 원판 (docs/design.md 순간 1)
  tone?: 'food' | 'onPrimary';
  // 조각마다 이름 아래 "N표". 아무도 안 찍어 조각이 같은 크기면 끈다
  showVotes?: boolean;
  // 원판 지름의 최대값. 결과 순간에서는 화면을 채우게 크게 준다
  maxSize?: number;
};

// 주황 바탕 위에서는 뽑힌 조각만 흰색, 나머지는 흰색을 번갈아 옅게
const ON_PRIMARY_OPACITY = [0.28, 0.5];

function sliceStyle(tone: 'food' | 'onPrimary', a: Arc, index: number, resultFoodId: number) {
  if (tone === 'food') {
    const c = foodColorValues(a.foodId);
    return {
      fill: c.fill,
      opacity: 1,
      label: c.label,
      stroke: colors.background,
      strokeWidth: 2,
    };
  }
  const winner = a.foodId === resultFoodId;
  return {
    fill: colors['on-primary'],
    opacity: winner ? 1 : ON_PRIMARY_OPACITY[index % ON_PRIMARY_OPACITY.length],
    label: winner ? colors.primary : colors['on-primary'],
    stroke: colors.primary,
    strokeWidth: 4,
  };
}

// 원판 (4-12). 결과는 서버가 이미 정했고, 원판은 모든 기기에서 그 조각에 멈추도록 돈다
export function Roulette({
  slices,
  resultFoodId,
  spin,
  onDone,
  tone = 'food',
  showVotes = false,
  maxSize = MAX_SIZE,
}: RouletteProps) {
  // 화면이 실시간 변경으로 다시 그려질 때마다 배열이 새로 와도, 조각이 같으면 원판을 다시 돌리지 않는다
  const sliceKey = slices.map((s) => `${s.foodId}:${s.weight}:${s.name}`).join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const arcs = useMemo(() => sliceArcs(slices), [sliceKey]);
  const { width } = useWindowDimensions();
  const SIZE = Math.min(maxSize, width - 40);
  const C = SIZE / 2;
  const R = C - 4;
  const target = useMemo(() => finalRotation(arcs, resultFoodId), [arcs, resultFoodId]);
  const [rotation] = useState(() => new Animated.Value(spin ? 0 : target));
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (!spin) {
      rotation.setValue(target);
      return;
    }
    doneRef.current = false;
    const finish = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      haptic('done');
      onDoneRef.current?.();
    };

    // 조각 경계를 지날 때 가벼운 진동
    let last = sliceAt(arcs, 0);
    const id = rotation.addListener(({ value }) => {
      const now = sliceAt(arcs, value);
      if (now !== last) {
        last = now;
        haptic('tick');
      }
    });

    rotation.setValue(0);
    const anim = Animated.timing(rotation, {
      toValue: target,
      duration: ROULETTE_SPIN_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    });
    // 끝까지 돌았을 때만 결과를 보인다. 중간에 멈춘 것(화면을 떠남)은 결과가 아니다
    anim.start(({ finished }) => {
      if (finished) finish();
    });
    // 화면이 뒤로 가서 애니메이션이 멈춰도 4초 뒤에는 결과를 보여준다
    const fallback = setTimeout(() => {
      rotation.setValue(target);
      finish();
    }, ROULETTE_RESULT_FALLBACK_MS);

    return () => {
      anim.stop();
      clearTimeout(fallback);
      rotation.removeListener(id);
    };
  }, [arcs, rotation, spin, target]);

  const rotate = rotation.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
    extrapolate: 'extend',
  });

  return (
    <View className="items-center" accessibilityRole="image" accessibilityLabel="룰렛 원판">
      {/* 바늘. 위쪽 가운데를 가리킨다 */}
      <View className="z-10 -mb-3 h-0 w-0 border-x-[12px] border-t-[20px] border-x-transparent border-t-text" />
      <Animated.View style={{ width: SIZE, height: SIZE, transform: [{ rotate }] }}>
        <Svg width={SIZE} height={SIZE}>
          {arcs.length === 1 ? (
            <Circle
              cx={C}
              cy={C}
              r={R}
              fill={sliceStyle(tone, arcs[0], 0, resultFoodId).fill}
              fillOpacity={sliceStyle(tone, arcs[0], 0, resultFoodId).opacity}
            />
          ) : (
            arcs.map((a, i) => {
              const s = sliceStyle(tone, a, i, resultFoodId);
              return (
                <Path
                  key={a.foodId}
                  d={slicePath(C, R, a.start, a.end)}
                  fill={s.fill}
                  fillOpacity={s.opacity}
                  stroke={s.stroke}
                  strokeWidth={s.strokeWidth}
                  strokeLinejoin="round"
                />
              );
            })
          )}
          {arcs.map((a, i) => {
            // 너무 얇은 조각에는 이름을 쓰지 않는다
            if (a.end - a.start < 14) return null;
            const mid = (a.start + a.end) / 2;
            const p = point(C, mid, R * 0.62);
            const s = sliceStyle(tone, a, i, resultFoodId);
            return (
              // 멈춘 채로 보이는 결과 순간에서는 글자를 똑바로 세운다(원판이 돌아간 만큼 되돌림)
              <G
                key={`label-${a.foodId}`}
                rotation={tone === 'onPrimary' ? -target : mid}
                origin={`${p.x}, ${p.y}`}>
                <SvgText
                  x={p.x}
                  y={showVotes ? p.y - 2 : p.y + 5}
                  fill={s.label}
                  fontSize={tone === 'onPrimary' ? 16 : 14}
                  fontWeight="bold"
                  textAnchor="middle">
                  {rouletteLabel(a.name)}
                </SvgText>
                {showVotes ? (
                  <SvgText
                    x={p.x}
                    y={p.y + 16}
                    fill={s.label}
                    fontSize={13}
                    fontWeight="bold"
                    textAnchor="middle">
                    {`${a.weight}표`}
                  </SvgText>
                ) : null}
              </G>
            );
          })}
          {tone === 'onPrimary' ? (
            <>
              <Circle cx={C} cy={C} r={22} fill={colors.ink} />
              <Circle cx={C} cy={C} r={6} fill={colors['on-ink']} />
            </>
          ) : (
            <Circle cx={C} cy={C} r={18} fill={colors.background} />
          )}
        </Svg>
      </Animated.View>
    </View>
  );
}
