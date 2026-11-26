import { type ReactNode, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { Button } from '@/components/button';
import { Text } from '@/components/text';
import { TextField } from '@/components/text-field';

// 출시 필수(4-24)에서 쓰는 가운데 카드 창. 모양은 이어 쓰기 창(account-sheet)과 같다: 여백 24, 아래 버튼 둘
export function Sheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/40 px-4">
        <View className="w-full max-w-[440px] gap-6 rounded-3xl bg-background p-6">{children}</View>
      </View>
    </Modal>
  );
}

// 한 줄씩 고르는 목록 (같은 역할 같은 크기, 높이 56)
export function ChoiceRow({ label, onPress, danger = false }: { label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="h-14 justify-center rounded-2xl bg-surface px-4 active:opacity-70">
      <Text className={`text-base font-bold ${danger ? 'text-danger' : 'text-text'}`}>{label}</Text>
    </Pressable>
  );
}

export function ConfirmSheet({
  visible,
  title,
  body,
  confirmLabel,
  danger = false,
  busy = false,
  error,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose}>
      <View className="gap-2">
        <Text className="text-xl font-bold tracking-tight text-text">{title}</Text>
        {body ? <Text className="text-base text-muted">{body}</Text> : null}
      </View>
      {error ? <Text className="text-sm text-danger">{error}</Text> : null}
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Button label="취소" variant="secondary" onPress={onClose} />
        </View>
        <View className="flex-1">
          {danger ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
              disabled={busy}
              onPress={onConfirm}
              className="h-14 items-center justify-center rounded-2xl bg-surface-strong active:opacity-70 disabled:opacity-50">
              <Text className="text-lg font-bold text-danger">{busy ? '처리하는 중' : confirmLabel}</Text>
            </Pressable>
          ) : (
            <Button label={confirmLabel} variant="primary" onPress={onConfirm} loading={busy} />
          )}
        </View>
      </View>
    </Sheet>
  );
}

// 이름 하나를 적는 창 (내 이름, 모임 이름). 열릴 때마다 안쪽을 새로 그려 처음 값으로 시작한다
type NameSheetProps = {
  visible: boolean;
  title: string;
  initial: string;
  maxLength: number;
  busy?: boolean;
  error?: string | null;
  onSave: (name: string) => void;
  onClose: () => void;
};

export function NameSheet(props: NameSheetProps) {
  return (
    <Sheet visible={props.visible} onClose={props.onClose}>
      {props.visible ? <NameSheetBody {...props} /> : null}
    </Sheet>
  );
}

function NameSheetBody({ title, initial, maxLength, busy = false, error, onSave, onClose }: NameSheetProps) {
  const [name, setName] = useState(initial);
  const ok = name.trim().length > 0 && name.trim() !== initial;
  return (
    <>
      <Text className="text-xl font-bold tracking-tight text-text">{title}</Text>
      <TextField
        value={name}
        onChangeText={setName}
        maxLength={maxLength}
        placeholder={title}
        error={error ?? undefined}
        autoFocus
        onSubmitEditing={() => ok && onSave(name.trim())}
      />
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Button label="취소" variant="secondary" onPress={onClose} />
        </View>
        <View className="flex-1">
          <Button label="저장" onPress={() => onSave(name.trim())} disabled={!ok} loading={busy} />
        </View>
      </View>
    </>
  );
}
