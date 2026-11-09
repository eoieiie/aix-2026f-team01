import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { FoodDot } from '@/components/food-dot';
import { FoodSearch } from '@/components/food-search';
import { IconButton } from '@/components/icon';
import colors from '@/constants/colors.json';
import { DIET_TAGS, INGREDIENT_TAGS, RESTRICTION_KINDS } from '@/constants/restrictions';
import {
  itemKey,
  restrictionErrorMessage,
  type RestrictionItem,
  setItemKind,
  toggleItem,
  useMyRestrictions,
  useSaveRestrictions,
} from '@/hooks/use-restrictions';
import { useFoods } from '@/hooks/use-session';

const TAG_LABELS = new Map<string, string>(
  [...INGREDIENT_TAGS, ...DIET_TAGS].map((t) => [t.code, t.label]),
);

// 못 먹는 것 등록 (spec.md 4-7, 7절 /restrictions). 판 화면 위쪽 "못 먹는 것"에서 오고, 저장하면 돌아간다
export default function RestrictionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { restrictions, isLoading, error, retrying, refetch } = useMyRestrictions();
  const { foods } = useFoods();
  const { save, isPending, error: saveError, reset } = useSaveRestrictions();

  // 화면에서 고치는 중인 목록. 서버 값으로 한 번 채우고, 저장에 실패해도 그대로 둔다
  const [draft, setDraft] = useState<RestrictionItem[] | null>(null);
  if (draft === null && restrictions) setDraft(restrictions);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={colors.primary} accessibilityLabel="못 먹는 것을 불러오는 중" />
      </SafeAreaView>
    );
  }

  if (error || draft === null) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-background px-6">
        <Text className="text-lg font-bold text-text">{restrictionErrorMessage(error)}</Text>
        <View className="w-full max-w-xs">
          <Button label="다시 시도" variant="secondary" onPress={() => refetch()} loading={retrying} />
        </View>
      </SafeAreaView>
    );
  }

  const chosen = new Set(draft.map(itemKey));
  const foodNames = new Map(foods.map((f) => [f.id, f.name]));
  const update = (next: RestrictionItem[]) => {
    setDraft(next);
    reset();
  };

  const onSave = async () => {
    try {
      // 아무것도 안 고르고 저장하면 전부 해제된다
      await save(draft);
      close();
    } catch {
      // 문구는 아래에 보이고 고른 것은 그대로 남는다
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-row px-5 pb-2 pt-3">
        <IconButton name="back" label="뒤로" onPress={close} />
      </View>

      <ScrollView contentContainerClassName="gap-8 px-5 pb-48 pt-2">
        <View className="gap-1">
          <Text className="text-3xl font-extrabold tracking-tight text-text">못 먹는 것</Text>
          <Text className="text-sm text-muted">
            한 번 적으면 내가 속한 모든 모임에 적용돼요. 누가 적었는지는 아무에게도 보이지 않아요
          </Text>
        </View>

        <TagSection
          title="재료"
          tags={INGREDIENT_TAGS}
          chosen={chosen}
          onToggle={(tag) => update(toggleItem(draft, { tag }))}
        />
        <TagSection
          title="식단"
          tags={DIET_TAGS}
          chosen={chosen}
          onToggle={(tag) => update(toggleItem(draft, { tag }))}
        />

        <View className="gap-3">
          <Text className="text-base font-bold text-text">음식</Text>
          <FoodSearch
            foods={foods}
            excludeIds={draft.flatMap((i) => (i.foodId !== null ? [i.foodId] : []))}
            onPick={(food) => update(toggleItem(draft, { foodId: food.id }))}
            pickLabel="못 먹는 것에 추가"
          />
        </View>

        <View className="gap-3">
          <Text className="text-base font-bold text-text">고른 것 {draft.length}개</Text>
          {draft.length === 0 ? (
            <Text className="text-sm text-muted">아직 고른 것이 없어요</Text>
          ) : (
            draft.map((item) => {
              const key = itemKey(item);
              const name =
                item.tag !== null ? (TAG_LABELS.get(item.tag) ?? item.tag) : (foodNames.get(item.foodId) ?? '');
              return (
                <Card key={key}>
                  <View className="flex-row items-center gap-3">
                    {item.foodId !== null ? <FoodDot foodId={item.foodId} size="sm" /> : null}
                    <Text className="flex-1 text-base font-bold text-text">{name}</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${name} 빼기`}
                      onPress={() =>
                        update(toggleItem(draft, item.tag !== null ? { tag: item.tag } : { foodId: item.foodId }))
                      }
                      className="rounded-full bg-background px-3 py-1.5 active:opacity-70">
                      <Text className="text-sm font-semibold text-text">빼기</Text>
                    </Pressable>
                  </View>
                  {/* 이유. 판정에는 쓰지 않는다 */}
                  <View className="flex-row gap-2">
                    {RESTRICTION_KINDS.map((kind) => {
                      const on = item.kind === kind.code;
                      return (
                        <Pressable
                          key={kind.code}
                          accessibilityRole="button"
                          accessibilityState={{ selected: on }}
                          accessibilityLabel={`${name} 이유 ${kind.label}`}
                          onPress={() => update(setItemKind(draft, key, kind.code))}
                          className={`rounded-full px-3 py-1.5 active:opacity-70 ${on ? 'bg-text' : 'bg-background'}`}>
                          <Text className={`text-sm font-semibold ${on ? 'text-on-primary' : 'text-muted'}`}>
                            {kind.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </Card>
              );
            })
          )}
        </View>
      </ScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 gap-2 bg-background px-5 pt-3"
        style={{ paddingBottom: insets.bottom + 16 }}>
        <Button label="저장" onPress={onSave} loading={isPending} />
        {saveError ? (
          <Text className="text-center text-sm text-danger">{restrictionErrorMessage(saveError)}</Text>
        ) : draft.length === 0 ? (
          <Text className="text-center text-sm text-muted">아무것도 고르지 않고 저장하면 전부 해제돼요</Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function TagSection({
  title,
  tags,
  chosen,
  onToggle,
}: {
  title: string;
  tags: readonly { code: string; label: string }[];
  chosen: Set<string>;
  onToggle: (tag: string) => void;
}) {
  return (
    <View className="gap-3">
      <Text className="text-base font-bold text-text">{title}</Text>
      <View className="flex-row flex-wrap gap-2">
        {tags.map((tag) => {
          const on = chosen.has(`tag:${tag.code}`);
          return (
            <Pressable
              key={tag.code}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={tag.label}
              onPress={() => onToggle(tag.code)}
              className={`rounded-full px-4 py-2 active:opacity-70 ${on ? 'bg-primary-soft' : 'bg-surface'}`}>
              <Text className={`text-sm font-semibold ${on ? 'text-primary' : 'text-text'}`}>
                {tag.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
