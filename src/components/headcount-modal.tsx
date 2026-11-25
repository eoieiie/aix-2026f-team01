import { choiceSurface } from '@/components/choice-colors';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/text';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { HEADCOUNT_MAX } from '@/constants';
import type { Member, SessionOptions } from '@/hooks/use-groups';

const MIN_PEOPLE = 2;

// "오늘 뭐 먹지"를 누르면 같이 먹을 사람을 체크한다 (4-6). 체크한 수 + 앱 없는 사람 수가 이 판의 인원수다.
// 이 수만큼 골라야 방장이 돌릴 수 있다 (4-12). 모임에 새로 들어온 사람은 실시간으로 목록에 붙고 처음부터 체크돼 있다.
// 옵션은 접어 둔다: 인당 표 수(1~3), 한 메뉴에 여러 표 (0019)
export function HeadcountModal({
  visible,
  members,
  myUserId,
  loading,
  error,
  onClose,
  onStart,
}: {
  visible: boolean;
  members: Member[];
  myUserId: string | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onStart: (count: number, options: SessionOptions) => void;
}) {
  // 뺀 사람만 적어 둔다. 그래서 새로 들어온 사람은 처음부터 체크돼 있다
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set());
  // 혼자인 모임은 예전처럼 2명에서 시작한다
  const [extra, setExtra] = useState(members.length < MIN_PEOPLE ? MIN_PEOPLE - members.length : 0);
  const [showOptions, setShowOptions] = useState(false);
  const [voteLimit, setVoteLimit] = useState(2);
  const [allowRepeat, setAllowRepeat] = useState(false);

  const checked = members.filter((m) => m.user_id === myUserId || !unchecked.has(m.user_id)).length;
  const total = checked + extra;
  const canStart = total >= MIN_PEOPLE && total <= HEADCOUNT_MAX;

  const toggle = (userId: string) =>
    setUnchecked((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });

  const seg = (label: string, on: boolean, onPress: () => void) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      className={`h-12 flex-1 items-center justify-center rounded-xl ${on ? 'bg-ink' : 'bg-surface'} active:opacity-70`} style={choiceSurface(on)}>
      <Text className={`text-base font-bold ${on ? 'text-on-ink' : 'text-text'}`}>{label}</Text>
    </Pressable>
  );

  const round = (name: 'minus' | 'plus', label: string, off: boolean, d: number) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off }}
      disabled={off}
      onPress={() => setExtra((n) => n + d)}
      className={`h-12 w-12 items-center justify-center rounded-full bg-surface active:opacity-70 ${off ? 'opacity-40' : ''}`}>
      <Icon name={name} size={22} />
    </Pressable>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/40 px-4">
        <View className="max-h-full w-full max-w-[440px] rounded-3xl bg-background">
          <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerClassName="gap-6 p-6">
            <Text className="text-3xl font-bold tracking-tight text-text">같이 먹을 사람</Text>

            <View className="flex-row flex-wrap gap-2">
              {members.map((m) => {
                const me = m.user_id === myUserId;
                const on = me || !unchecked.has(m.user_id);
                return (
                  <Pressable
                    key={m.user_id}
                    accessibilityRole="checkbox"
                    accessibilityLabel={m.display_name}
                    accessibilityState={{ checked: on, disabled: me }}
                    disabled={me}
                    onPress={() => toggle(m.user_id)}
                    className={`h-11 max-w-full flex-row items-center gap-1 rounded-full px-4 ${on ? 'bg-ink' : 'bg-surface'} active:opacity-70`} style={choiceSurface(on)}>
                    {on ? <Icon name="check" size={16} color="on-ink" /> : null}
                    <Text numberOfLines={1} className={`text-base font-bold ${on ? 'text-on-ink' : 'text-muted'}`}>
                      {m.display_name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View className="flex-row items-center gap-2">
              <Text className="flex-1 text-base font-bold text-text">앱 없는 사람</Text>
              {round('minus', '앱 없는 사람 한 명 빼기', extra <= 0, -1)}
              <Text accessibilityLabel={`앱 없는 사람 ${extra}명`} className="min-w-10 text-center text-xl font-bold text-text">
                {extra}
              </Text>
              {round('plus', '앱 없는 사람 한 명 더하기', total >= HEADCOUNT_MAX, 1)}
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: showOptions }}
              onPress={() => setShowOptions((v) => !v)}
              className="h-12 flex-row items-center justify-between rounded-2xl bg-surface px-4 active:opacity-70">
              <Text className="text-base font-bold text-text">
                옵션 · 인당 {voteLimit}표{allowRepeat ? ' · 한 메뉴에 여러 표' : ''}
              </Text>
              <Icon name={showOptions ? 'minus' : 'plus'} size={18} />
            </Pressable>

            {showOptions ? (
              <View className="gap-4">
                <View className="gap-2">
                  <Text className="text-sm font-bold text-text">인당 표 수</Text>
                  <View className="flex-row gap-2">
                    {[1, 2, 3].map((n) => seg(`${n}표`, voteLimit === n, () => setVoteLimit(n)))}
                  </View>
                </View>
                <View className="gap-2">
                  <Text className="text-sm font-bold text-text">한 메뉴에 여러 표</Text>
                  <View className="flex-row gap-2">
                    {seg('끔', !allowRepeat, () => setAllowRepeat(false))}
                    {seg('켬', allowRepeat, () => setAllowRepeat(true))}
                  </View>
                </View>
              </View>
            ) : null}

            {error ? <Text className="text-sm font-semibold text-danger">{error}</Text> : null}
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Button label="취소" variant="secondary" onPress={onClose} disabled={loading} />
              </View>
              <View className="flex-1">
                <Button
                  label={`${total}명 시작`}
                  onPress={() => onStart(total, { voteLimit, allowRepeat })}
                  loading={loading}
                  disabled={!canStart}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
