import { View } from 'react-native';
import { Text } from '@/components/text';

// 받은 쿠폰을 가게 직원에게 보여 주는 칸 (spec.md 4-21, 4-23). 코드는 멀리서도 읽히게 크게, 가게 이름과 혜택, 받은 날을 같이
export function CouponCode({ code, shop, benefit }: { code: string; shop: string; benefit: string }) {
  const today = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
  return (
    <View
      accessible
      accessibilityLabel={`${shop} 쿠폰 코드 ${code.split('').join(' ')}, ${benefit}`}
      className="items-center gap-2 rounded-2xl border-2 border-ink bg-background px-4 py-4">
      <Text className="text-sm font-bold text-text">{shop}</Text>
      <Text className="text-4xl font-bold tracking-widest text-text">{code}</Text>
      <Text className="text-center text-sm text-text">{benefit}</Text>
      <Text className="text-xs text-muted">{today} 밥비티아이</Text>
    </View>
  );
}
