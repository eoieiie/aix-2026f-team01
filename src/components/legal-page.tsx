import { useRouter } from 'expo-router';
import { Linking, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconButton } from '@/components/icon';
import { Text } from '@/components/text';

export type LegalSection = { title: string; lines: string[]; link?: { label: string; href: `mailto:${string}` } };

// 개인정보 처리방침, 이용약관, 문의 (명세 4-24). 웹 주소로도 열린다(앱스토어 제출용)
export function LegalPage({ title, updated, sections }: { title: string; updated?: string; sections: LegalSection[] }) {
  const router = useRouter();
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center px-4 py-3">
        <IconButton
          name="back"
          label="뒤로"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/' as any))}
        />
      </View>
      <ScrollView contentContainerClassName="gap-6 px-4 pb-16 pt-2">
        <View className="gap-1">
          <Text className="text-3xl font-bold tracking-tight text-text">{title}</Text>
          {updated ? <Text className="text-sm text-muted">{updated}</Text> : null}
        </View>
        {sections.map((s) => (
          <View key={s.title} className="gap-2">
            <Text className="text-lg font-bold text-text">{s.title}</Text>
            {s.link ? (
              <MailLink {...s.link} />
            ) : null}
            {s.lines.map((l, i) => (
              <Text key={i} className="text-base leading-6 text-text">
                {l}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function MailLink({ href, label }: NonNullable<LegalSection['link']>) {
  // 웹에서는 브라우저가 메일 주소로 직접 연결하고, 앱에서는 운영체제에 맡긴다.
  const action = Platform.OS === 'web'
    ? { href }
    : { onPress: () => void Linking.openURL(href).catch(() => undefined) };
  return (
    <Pressable accessibilityRole="link" {...action} className="min-h-11 justify-center active:opacity-70">
      <Text className="text-base font-bold text-text underline">{label}</Text>
    </Pressable>
  );
}
