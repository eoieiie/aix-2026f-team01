import { useState } from 'react';
import { Modal, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { HeadcountStepper } from '@/components/headcount-stepper';

// "오늘 뭐 먹지"를 누르면 먼저 몇 명이서 먹는지 고른다 (4-6). 이 수만큼 골라야 방장이 돌릴 수 있다 (4-12)
export function HeadcountModal({
  visible,
  initial,
  loading,
  error,
  onClose,
  onStart,
}: {
  visible: boolean;
  initial: number;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onStart: (count: number) => void;
}) {
  // 창을 열 때마다 새로 그려서(부르는 쪽이 열 때만 넣는다) 처음 값으로 돌아간다
  const [count, setCount] = useState(initial);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/40 px-5">
        <View className="w-full max-w-sm items-center gap-8 rounded-3xl bg-background p-6">
          <Text className="self-start text-3xl font-extrabold tracking-tight text-text">
            몇 명이서 먹어요?
          </Text>
          <HeadcountStepper value={count} onChange={setCount} big />
          {error ? <Text className="text-sm font-semibold text-danger">{error}</Text> : null}
          <View className="w-full flex-row gap-2">
            <View className="flex-1">
              <Button label="취소" variant="secondary" onPress={onClose} disabled={loading} />
            </View>
            <View className="flex-1">
              <Button label="시작" onPress={() => onStart(count)} loading={loading} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
