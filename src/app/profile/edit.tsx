import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Icon, IconButton } from '@/components/icon';
import { Sheet } from '@/components/sheets';
import { Text } from '@/components/text';
import { TextField } from '@/components/text-field';
import { DISPLAY_NAME_MAX } from '@/constants';
import colors from '@/constants/colors.json';
import {
  type AvatarOption,
  COLLEGES,
  CUISINES,
  EMPTY_PREFS,
  type MyPrefs,
  SPICE_LEVELS,
  prefsPatch,
  sortAvatarOptions,
  toggleIn,
} from '@/constants/prefs';
import { prefsErrorMessage, useAvatarOptions, useMyPrefs, useSavePrefs } from '@/hooks/use-prefs';
import { useMyProfile } from '@/hooks/use-profile';
import { safetyErrorMessage, useSafety } from '@/hooks/use-safety';

// 프로필 고치기 (명세 4-27, 7절 /profile/edit). 이름, 아바타, 단과대, 취향. 이름 말고는 전부 안 골라도 된다.
// 고른 상태는 검정 면, 주황은 아래 "저장" 하나
export default function ProfileEditScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const profile = useMyProfile();
  const { prefs, isLoading } = useMyPrefs();
  const { options } = useAvatarOptions();
  const save = useSavePrefs();
  const safety = useSafety();

  // 화면에서 고치는 중인 값. 서버 값으로 한 번 채우고, 저장에 실패해도 그대로 둔다
  const [draft, setDraft] = useState<MyPrefs | null>(null);
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/profile' as any));

  if (isLoading || profile.isPending) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={colors.text} accessibilityLabel="프로필을 불러오는 중" />
      </SafeAreaView>
    );
  }

  const savedName = profile.data?.displayName ?? '';
  const name = nameDraft ?? savedName;
  const base = prefs ?? EMPTY_PREFS;
  const current = draft ?? base;
  const set = (patch: Partial<MyPrefs>) => setDraft({ ...current, ...patch });
  const busy = save.isPending || safety.setName.isPending;
  const unlocked = options.filter((o) => o.unlocked).length;

  const onSave = async () => {
    setError(null);
    const trimmed = name.trim();
    try {
      if (trimmed !== savedName) await safety.setName.mutateAsync(trimmed);
    } catch (e) {
      setError(safetyErrorMessage(e));
      return;
    }
    try {
      // 화면에 없는 항목은 기존 값과 같게 두어 저장 요청에 넣지 않는다.
      const patch = prefsPatch(base, { ...current, budgetLevel: base.budgetLevel, mealTimes: base.mealTimes });
      if (patch) await save.mutateAsync(patch);
    } catch (e) {
      setError(prefsErrorMessage(e));
      return;
    }
    close();
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-row px-4 pb-2 pt-3">
        <IconButton name="back" label="뒤로" onPress={close} />
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerClassName="gap-8 px-4 pt-2"
        contentContainerStyle={{ paddingBottom: 136 + insets.bottom }}
        showsVerticalScrollIndicator={false}>
        <View className="gap-1">
          <Text className="text-3xl font-bold tracking-tight text-text">프로필 고치기</Text>
          <Text className="text-sm text-muted">안 골라도 돼요. 단과대와 취향은 나만 봐요</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="아바타 고르기"
          onPress={() => setPicker(true)}
          className="flex-row items-center gap-4 rounded-2xl bg-surface p-4 active:opacity-80">
          <Avatar name={name || '?'} foodId={current.avatarFoodId} size={72} />
          <View className="flex-1 gap-1">
            <Text className="text-lg font-bold text-text">아바타</Text>
            <Text className="text-sm text-muted">{unlocked}개 열려 있어요</Text>
          </View>
          <Icon name="pencil" size={20} />
        </Pressable>

        <TextField label="이름" value={name} onChangeText={setNameDraft} maxLength={DISPLAY_NAME_MAX} />

        <Section title="단과대">
          {pairs([{ key: null, label: '말하지 않기' }, ...COLLEGES]).map((row, i) => (
            <View key={i} className="flex-row gap-2">
              {row.map((c) => (
                <Chip key={c.label} label={c.label} on={current.college === c.key} onPress={() => set({ college: c.key })} />
              ))}
              {row.length === 1 ? <View className="flex-1" /> : null}
            </View>
          ))}
        </Section>

        <Section title="좋아하는 종류">
          <View className="flex-row gap-2">
            {CUISINES.map((c) => (
              <Chip
                key={c.key}
                label={c.label}
                on={current.favCuisines.includes(c.key)}
                onPress={() => set({ favCuisines: toggleIn(current.favCuisines, c.key, CUISINES.map((x) => x.key)) })}
              />
            ))}
          </View>
        </Section>

        <Section title="매운맛">
          <View className="flex-row gap-2">
            {SPICE_LEVELS.map((s) => (
              <Chip
                key={s.value}
                label={s.label}
                on={current.spiceLevel === s.value}
                onPress={() => set({ spiceLevel: current.spiceLevel === s.value ? null : s.value })}
              />
            ))}
          </View>
        </Section>
      </ScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 gap-2 bg-background px-4 pt-3"
        style={{ paddingBottom: 16 + insets.bottom }}>
        {error ? <Text className="text-center text-sm font-semibold text-danger">{error}</Text> : null}
        <Button label="저장" onPress={onSave} loading={busy} disabled={name.trim().length === 0} />
      </View>

      <AvatarPicker
        visible={picker}
        name={name || '?'}
        options={options}
        selected={current.avatarFoodId}
        onPick={(foodId) => {
          set({ avatarFoodId: foodId });
          setPicker(false);
        }}
        onClose={() => setPicker(false)}
      />
    </SafeAreaView>
  );
}

function pairs<T>(items: readonly T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += 2) out.push(items.slice(i, i + 2));
  return out;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-3">
      <Text className="text-base font-bold text-text">{title}</Text>
      <View className="gap-2">{children}</View>
    </View>
  );
}

// 고르는 칸. 한 줄의 칸은 같은 폭, 같은 높이(44). 고른 것은 검정 면
function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      onPress={onPress}
      className={`h-11 flex-1 items-center justify-center rounded-xl px-1 active:opacity-70 ${on ? 'bg-ink' : 'bg-surface'}`}>
      <Text className={`text-sm font-bold ${on ? 'text-on-ink' : 'text-text'}`} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

// 아바타 고르기 창. 열린 것 먼저, 잠긴 것은 흐리게 두고 열리는 레벨을 적는다. 누르면 바로 고르고 닫는다
function AvatarPicker({
  visible,
  name,
  options,
  selected,
  onPick,
  onClose,
}: {
  visible: boolean;
  name: string;
  options: AvatarOption[];
  selected: number | null;
  onPick: (foodId: number | null) => void;
  onClose: () => void;
}) {
  const rows: (AvatarOption | null)[][] = [];
  const cells: (AvatarOption | null)[] = [null, ...sortAvatarOptions(options)];
  for (let i = 0; i < cells.length; i += 4) rows.push(cells.slice(i, i + 4));

  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text className="text-2xl font-bold tracking-tight text-text">아바타 고르기</Text>
      <ScrollView style={{ maxHeight: 392 }} showsVerticalScrollIndicator={false}>
        <View className="gap-3">
          {rows.map((row, r) => (
            <View key={r} className="flex-row gap-2">
              {row.map((o) => {
                const on = (o?.foodId ?? null) === selected;
                const locked = o ? !o.unlocked : false;
                const label = o ? o.name : '첫 글자';
                return (
                  <Pressable
                    key={o?.foodId ?? 'none'}
                    accessibilityRole="button"
                    accessibilityLabel={locked ? `${label}, 레벨 ${o?.unlockLevel}에 열려요` : label}
                    accessibilityState={{ selected: on, disabled: locked }}
                    disabled={locked}
                    onPress={() => onPick(o?.foodId ?? null)}
                    className="flex-1 items-center gap-1 active:opacity-70">
                    <View style={{ opacity: locked ? 0.3 : 1 }}>
                      <Avatar name={name} foodId={o?.foodId ?? null} size={72} />
                    </View>
                    {on ? (
                      <View className="absolute right-0 top-0 h-6 w-6 items-center justify-center rounded-full bg-ink">
                        <Icon name="check" size={14} color="on-ink" />
                      </View>
                    ) : null}
                    <Text className={`text-xs font-bold ${locked ? 'text-muted' : 'text-text'}`} numberOfLines={1}>
                      {locked ? `레벨 ${o?.unlockLevel}` : label}
                    </Text>
                  </Pressable>
                );
              })}
              {Array.from({ length: 4 - row.length }).map((_, i) => (
                <View key={`e${i}`} className="flex-1" />
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
      <Button label="닫기" variant="secondary" onPress={onClose} />
    </Sheet>
  );
}
