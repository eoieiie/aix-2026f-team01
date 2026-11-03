import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

// 기기에서 "동작 줄이기"를 켰는지. 켰으면 움직임 없이 마지막 모습만 보인다 (docs/design.md 3절)
export function useReduceMotion() {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (alive) setReduce(value);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  return reduce;
}
