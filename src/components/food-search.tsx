import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { FoodDot } from '@/components/food-dot';
import { TextField } from '@/components/text-field';
import { FOOD_SEARCH_LIMIT } from '@/constants';
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
};

// 음식 이름 일부를 치면 최대 6개를 보여주고, 누르면 후보로 올린다 (4-9). 못 먹는 것 화면에서도 쓴다 (4-7)
export function FoodSearch({
  foods,
  excludeIds,
  onPick,
  pickLabel = '후보로 올리기',
  disabled,
  error,
}: FoodSearchProps) {
  const [query, setQuery] = useState('');
  const results = searchFoods(foods, query, excludeIds, FOOD_SEARCH_LIMIT);

  return (
    <View className="gap-2">
      <TextField
        value={query}
        onChangeText={setQuery}
        maxLength={20}
        placeholder="음식 찾기 (예: 찌개, 국수)"
        error={error}
        showCount={false}
      />
      <View className="flex-row flex-wrap gap-2">
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
            className="flex-row items-center gap-2 rounded-full bg-surface py-2.5 pl-2.5 pr-5 active:opacity-70 disabled:opacity-50">
            <FoodDot foodId={food.id} size="sm" />
            <Text className="text-base font-bold text-text">{food.name}</Text>
          </Pressable>
        ))}
        {results.length === 0 ? (
          <Text className="text-sm text-muted">찾는 음식이 없어요</Text>
        ) : null}
      </View>
    </View>
  );
}
