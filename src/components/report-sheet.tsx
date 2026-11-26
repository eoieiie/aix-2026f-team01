import { useState } from 'react';
import { View } from 'react-native';

import { ChoiceRow, Sheet } from '@/components/sheets';
import { Button } from '@/components/button';
import { Text } from '@/components/text';
import { REPORT_REASONS, safetyErrorMessage, useSafety, type ReportKind } from '@/hooks/use-safety';

export type ReportTarget = {
  kind: ReportKind;
  groupId: string;
  sessionId?: string;
  foodId?: number;
  // 차단할 사람. 없으면 차단 줄을 보이지 않는다
  userId?: string;
};

// 신고와 차단 (명세 4-24, 애플 1.2). 이유를 하나 누르면 바로 접수된다. 팀이 24시간 안에 확인한다
export function ReportSheet({ target, onClose }: { target: ReportTarget | null; onClose: () => void }) {
  const { report, block } = useSafety();
  const [done, setDone] = useState<string | null>(null);

  const close = () => {
    setDone(null);
    report.reset();
    block.reset();
    onClose();
  };
  const error = report.error ?? block.error;

  return (
    <Sheet visible={!!target} onClose={close}>
      {done ? (
        <>
          <Text className="text-xl font-bold tracking-tight text-text">{done}</Text>
          <Button label="닫기" variant="secondary" onPress={close} />
        </>
      ) : (
        <>
          <Text className="text-xl font-bold tracking-tight text-text">신고하기</Text>
          <View className="gap-2">
            {REPORT_REASONS.map((r) => (
              <ChoiceRow
                key={r.code}
                label={r.label}
                onPress={() =>
                  target &&
                  !report.isPending &&
                  report.mutate(
                    { kind: target.kind, reason: r.code, groupId: target.groupId, sessionId: target.sessionId, foodId: target.foodId, userId: target.userId },
                    { onSuccess: () => setDone('신고했어요. 24시간 안에 확인해요') }
                  )
                }
              />
            ))}
            {target?.userId ? (
              <ChoiceRow
                label="이 사람 차단"
                danger
                onPress={() =>
                  !block.isPending && block.mutate(target.userId!, { onSuccess: () => setDone('차단했어요. 이 사람의 글이 가려져요') })
                }
              />
            ) : null}
          </View>
          {error ? <Text className="text-sm font-semibold text-danger">{safetyErrorMessage(error)}</Text> : null}
          <Button label="취소" variant="secondary" onPress={close} />
        </>
      )}
    </Sheet>
  );
}
