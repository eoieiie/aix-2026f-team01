import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { FoodDot } from '@/components/food-dot';
import { Icon } from '@/components/icon';
import { TextField } from '@/components/text-field';
import { FOOD_NAME_MAX, FOOD_SEARCH_LIMIT } from '@/constants';
import { type Food, searchFoods } from '@/hooks/use-session';

type FoodSearchProps = {
  foods: Food[];
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
  excludeIds,
  onPick,
  pickLabel = '후보로 올리기',
  disabled,
  error,
  onCustom,
}: FoodSearchProps) {
  const [query, setQuery] = useState('');
  const results = searchFoods(foods, query, excludeIds, FOOD_SEARCH_LIMIT);
  const typed = query.trim();
  // 적은 이름과 똑같은 음식이 목록에 없을 때만 "올리기" 줄을 보인다
  const canCustom = !!onCustom && typed.length > 0 && !foods.some((f) => f.name === typed);

  return (
    <View className="gap-2">
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
            className="h-14 w-[49%] flex-row items-center gap-2 rounded-full bg-surface pl-3 pr-4 active:opacity-70 disabled:opacity-50">
            <FoodDot foodId={food.id} size="sm" />
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
            className="h-14 w-full flex-row items-center gap-2 rounded-full bg-ink pl-4 pr-5 active:opacity-80 disabled:opacity-50">
            <Icon name="plus" size={20} color="on-ink" />
            <Text className="flex-1 text-base font-bold text-on-ink" numberOfLines={1}>
              {typed}
            </Text>
            <Text className="text-sm font-semibold text-on-ink opacity-60">올리기</Text>
          </Pressable>
        ) : results.length === 0 ? (
          <Text className="text-sm text-muted">찾는 음식이 없어요</Text>
        ) : null}
      </View>
    </View>
  );
}
