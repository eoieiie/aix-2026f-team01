import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// 홈. 내 모임 목록과 모임 만들기는 C 묶음에서 채운다 (spec.md 4-2, 4-3)
export default function HomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center gap-2 px-6">
        <Text className="text-3xl font-bold text-text">밥비티아이</Text>
        <Text className="text-base text-muted">오늘 뭐 먹지</Text>
      </View>
    </SafeAreaView>
  );
}
