import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { IconButton } from '@/components/icon';
import { ReportSheet } from '@/components/report-sheet';
import { ChoiceRow, ConfirmSheet, NameSheet, Sheet } from '@/components/sheets';
import { Text } from '@/components/text';
import { safetyErrorMessage, useSafety } from '@/hooks/use-safety';

// 모임 화면 오른쪽 위 ⋯ (명세 4-24). 방장은 이름 바꾸기, 아닌 사람은 모임 이름 신고. 누구나 모임 나가기
export function GroupMenu({
  groupId,
  name,
  isOwner,
  onLeft,
}: {
  groupId: string;
  name: string;
  isOwner: boolean;
  onLeft: () => void;
}) {
  const { rename, leave } = useSafety();
  const [sheet, setSheet] = useState<null | 'menu' | 'rename' | 'leave' | 'report'>(null);
  const close = () => {
    rename.reset();
    leave.reset();
    setSheet(null);
  };

  return (
    <>
      <IconButton name="more" label="모임 메뉴" onPress={() => setSheet('menu')} />
      <Sheet visible={sheet === 'menu'} onClose={close}>
        <Text className="text-2xl font-bold tracking-tight text-text" numberOfLines={2}>
          {name}
        </Text>
        <View className="gap-2">
          {isOwner ? (
            <ChoiceRow label="모임 이름 바꾸기" onPress={() => setSheet('rename')} />
          ) : (
            <ChoiceRow label="모임 이름 신고" onPress={() => setSheet('report')} />
          )}
          <ChoiceRow label="모임 나가기" danger onPress={() => setSheet('leave')} />
        </View>
        <Button label="닫기" variant="secondary" onPress={close} />
      </Sheet>
      <NameSheet
        visible={sheet === 'rename'}
        title="모임 이름"
        initial={name}
        maxLength={40}
        busy={rename.isPending}
        error={rename.error ? safetyErrorMessage(rename.error) : null}
        onSave={(n) => rename.mutate({ groupId, name: n }, { onSuccess: close })}
        onClose={close}
      />
      <ConfirmSheet
        visible={sheet === 'leave'}
        title="모임에서 나갈까요?"
        body={
          isOwner
            ? '진행 중인 판에서 빠지고, 방장은 먼저 들어온 사람에게 넘어가요. 지난 식사 기록은 모임에 남아요'
            : '진행 중인 판에서 빠져요. 지난 식사 기록은 모임에 남아요'
        }
        confirmLabel="나가기"
        danger
        busy={leave.isPending}
        error={leave.error ? safetyErrorMessage(leave.error) : null}
        // 나가면 모임 화면이 바로 "멤버가 아니에요"로 바뀌어 이 창이 사라질 수 있어 끝을 기다린 뒤 옮긴다
        onConfirm={() =>
          leave
            .mutateAsync(groupId)
            .then(onLeft)
            .catch(() => undefined)
        }
        onClose={close}
      />
      <ReportSheet target={sheet === 'report' ? { kind: 'group_name', groupId } : null} onClose={close} />
    </>
  );
}
