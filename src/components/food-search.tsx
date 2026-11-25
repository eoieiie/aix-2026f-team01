import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/text';

import { FoodThumb } from '@/components/food-thumb';
import { Icon } from '@/components/icon';
import { TextField } from '@/components/text-field';
import { FOOD_NAME_MAX, FOOD_SEARCH_LIMIT } from '@/constants';
import { type Food, searchFoods } from '@/hooks/use-session';

type FoodSearchProps = {
  foods: Food[];
  myPicks?: Food[];
  // 이미 후보에 올라간 음식. 검색 목록에서 빠진다 (4-9)
  excludeIds: number[];
  onPick: (food: Food) => void;
  // 누를 때 읽어 주는 동작 이름. 못 먹는 것 화면(4-7)은 "못 먹는 것에 추가"
  pickLabel?: string;
  disabled?: boolean;
  error?: string | null;
  // 있으면 목록에 없는 이름을 그대로 올리는 줄이 생긴다 (4-9 직접 적기). 못 먹는 것 화면은 없다
  onCustom?: (name: string) => void;
};

// 음식 이름 일부를 치면 최대 6개를 보여주고, 누르면 후보로 올린다 (4-9). 못 먹는 것 화면에서도 쓴다 (4-7)
export function FoodSearch({
  foods,
  myPicks = [],
  excludeIds,
  onPick,
  pickLabel = '후보로 올리기',
  disabled,
  error,
  onCustom,
}: FoodSearchProps) {
  const [query, setQuery] = useState('');
  const typed = query.trim();
  const visiblePicks = typed ? [] : myPicks.filter((food) => !excludeIds.includes(food.id));
  const results = searchFoods(foods, query, [...excludeIds, ...visiblePicks.map((food) => food.id)], FOOD_SEARCH_LIMIT);
  // 적은 이름과 똑같은 음식이 목록에 없을 때만 "올리기" 줄을 보인다
  const canCustom = !!onCustom && typed.length > 0 && !foods.some((f) => f.name === typed);

  return (
    <View className="gap-2">
      {visiblePicks.length > 0 ? (
        <View className="mb-4 gap-2">
          <Text className="text-base font-bold text-text" accessibilityRole="header">내 추천</Text>
          <View className="flex-row gap-2">
            {visiblePicks.map((food) => (
              <Pressable
                key={food.id}
                accessibilityRole="button"
                accessibilityLabel={`${food.name} ${pickLabel}`}
                disabled={disabled}
                onPress={() => onPick(food)}
                className="min-w-0 flex-1 items-center gap-2 rounded-xl bg-surface p-3 active:opacity-70 disabled:opacity-50">
                <FoodThumb foodId={food.id} size="sm" />
                <Text className="text-center text-sm font-bold text-text" numberOfLines={1}>
                  {food.name}
                </Text>
              </Pressable>
            ))}
            {Array.from({ length: 3 - visiblePicks.length }, (_, i) => (
              <View key={i} className="flex-1" />
            ))}
          </View>
        </View>
      ) : null}
      <TextField
        value={query}
        onChangeText={setQuery}
        maxLength={FOOD_NAME_MAX}
        placeholder="음식 찾기 (예: 찌개, 국수)"
        error={error}
        showCount={false}
        // 엔터를 누르면 이름이 같은 음식, 하나뿐인 결과, 아니면 직접 적기 순으로 올린다. 검색칸에 이름만 적고 끝내는 사람이 있었다 (#44 인터뷰 3)
        onSubmitEditing={() => {
          if (disabled || typed.length === 0) return;
          const exact = results.find((f) => f.name === typed);
          const pick = exact ?? (results.length === 1 ? results[0] : undefined);
          if (pick) onPick(pick);
          else if (canCustom) onCustom?.(typed);
          else return;
          setQuery('');
        }}
      />
      {/* 고르기 칸은 글 길이와 상관없이 같은 크기로 두 칸씩 (docs/design.md 4절 "같은 역할은 같은 크기") */}
      <View className="flex-row flex-wrap justify-between gap-y-2">
        {results.map((food) => (
          <Pressable
            key={food.id}
            accessibilityRole="button"
            accessibilityLabel={`${food.name} ${pickLabel}`}
            disabled={disabled}
            onPress={() => {
              onPick(food);
              setQuery('');
            }}
            className="h-14 w-[49%] flex-row items-center gap-2 rounded-xl bg-surface pl-2 pr-3 active:opacity-70 disabled:opacity-50">
            <FoodThumb foodId={food.id} size="xs" />
            <Text className="flex-1 text-base font-bold text-text" numberOfLines={1}>
              {food.name}
            </Text>
          </Pressable>
        ))}
        {canCustom ? (
          // 목록에 없는 메뉴: 적은 이름 그대로 올린다. 고르기 칸과 같은 높이, 한 줄을 다 쓴다
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${typed} 직접 올리기`}
            disabled={disabled}
            onPress={() => {
              onCustom?.(typed);
              setQuery('');
            }}
            className="h-14 w-full flex-row items-center gap-2 rounded-xl bg-ink pl-4 pr-4 active:opacity-80 disabled:opacity-50">
            <Icon name="plus" size={20} color="on-ink" />
            {/* 검정 면에 흰 글자. 주황은 아래 "투표 시작" 하나에만 쓴다. "올리기" 글은 더하기 아이콘으로 대신한다 */}
            <Text className="flex-1 text-xl font-bold text-on-ink" numberOfLines={1}>
              {typed}
            </Text>
          </Pressable>
        ) : results.length === 0 ? (
          <Text className="text-sm text-muted">찾는 음식이 없어요</Text>
        ) : null}
      </View>
    </View>
  );
}
