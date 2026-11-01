import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { FoodDot } from '@/components/food-dot';
import { TextField } from '@/components/text-field';
import { DISPLAY_NAME_MAX, GROUP_NAME_MAX } from '@/constants';

// 개발용 부품 모음 (이슈 #10). 공통 부품이 어떻게 보이는지 한 화면에서 확인한다. 1단계 화면 목록에는 없다
export default function PartsScreen() {
  const [groupName, setGroupName] = useState('');
  const [displayName, setDisplayName] = useState('밥친구');
  const [pressed, setPressed] = useState(0);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="gap-8 px-6 py-8">
        <Text className="text-2xl font-bold text-text">부품 모음</Text>

        <View className="gap-3">
          <Text className="text-base font-semibold text-muted">Button</Text>
          <Button label={`눌러 보기 (${pressed})`} onPress={() => setPressed((n) => n + 1)} />
          <Button label="보조 버튼" variant="secondary" onPress={() => setPressed((n) => n + 1)} />
          <Button label="이름을 적으면 켜져요" disabled={groupName.trim() === ''} onPress={() => {}} />
          <Button label="기다리는 중" loading onPress={() => {}} />
        </View>

        <View className="gap-3">
          <Text className="text-base font-semibold text-muted">TextField</Text>
          <TextField
            label="모임 이름"
            placeholder="예: 점심 메이트"
            value={groupName}
            onChangeText={setGroupName}
            maxLength={GROUP_NAME_MAX}
          />
          <TextField
            label="내 이름"
            value={displayName}
            onChangeText={setDisplayName}
            maxLength={DISPLAY_NAME_MAX}
            error="이미 있는 이름이에요"
          />
        </View>

        <View className="gap-3">
          <Text className="text-base font-semibold text-muted">Card</Text>
          <Card>
            <Text className="text-base font-semibold text-text">점심 메이트</Text>
            <Text className="text-sm text-muted">멤버 4명</Text>
          </Card>
          <Card accessibilityLabel="초대 링크 복사" onPress={() => setPressed((n) => n + 1)}>
            <Text className="text-base font-semibold text-text">초대 링크 복사</Text>
            <Text className="text-sm text-muted">누를 수 있는 카드</Text>
          </Card>
        </View>

        <View className="gap-3">
          <Text className="text-base font-semibold text-muted">FoodDot</Text>
          <View className="flex-row flex-wrap gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((id) => (
              <FoodDot key={id} foodId={id} name={`음식 ${id}`} />
            ))}
          </View>
          <View className="flex-row items-center gap-3">
            <FoodDot foodId={3} size="sm" />
            <FoodDot foodId={3} size="md" />
            <FoodDot foodId={3} size="lg" />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
