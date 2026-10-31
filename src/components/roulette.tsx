import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';
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

const SIZE = 280;
const R = SIZE / 2 - 4;
const C = SIZE / 2;

function point(angle: number, radius: number) {
  const rad = (angle * Math.PI) / 180;
  return { x: C + radius * Math.sin(rad), y: C - radius * Math.cos(rad) };
}

function slicePath(start: number, end: number) {
  const p0 = point(start, R);
  const p1 = point(end, R);
  const large = end - start > 180 ? 1 : 0;
  return `M ${C} ${C} L ${p0.x} ${p0.y} A ${R} ${R} 0 ${large} 1 ${p1.x} ${p1.y} Z`;
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
};

// 원판 (4-12). 결과는 서버가 이미 정했고, 원판은 모든 기기에서 그 조각에 멈추도록 돈다
export function Roulette({ slices, resultFoodId, spin, onDone }: RouletteProps) {
  const arcs = useMemo(() => sliceArcs(slices), [slices]);
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
    anim.start(() => finish());
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
            <Circle cx={C} cy={C} r={R} fill={foodColorValues(arcs[0].foodId).fill} />
          ) : (
            arcs.map((a) => (
              <Path
                key={a.foodId}
                d={slicePath(a.start, a.end)}
                fill={foodColorValues(a.foodId).fill}
                stroke={colors.background}
                strokeWidth={2}
              />
            ))
          )}
          {arcs.map((a) => {
            // 너무 얇은 조각에는 이름을 쓰지 않는다
            if (a.end - a.start < 14) return null;
            const mid = (a.start + a.end) / 2;
            const p = point(mid, R * 0.62);
            return (
              <G key={`label-${a.foodId}`} rotation={mid} origin={`${p.x}, ${p.y}`}>
                <SvgText
                  x={p.x}
                  y={p.y + 5}
                  fill={foodColorValues(a.foodId).label}
                  fontSize={14}
                  fontWeight="bold"
                  textAnchor="middle">
                  {rouletteLabel(a.name)}
                </SvgText>
              </G>
            );
          })}
          <Circle cx={C} cy={C} r={18} fill={colors.background} />
        </Svg>
      </Animated.View>
    </View>
  );
}
