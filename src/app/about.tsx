import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { type ReactNode, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AdBadge } from '@/components/ad-badge';
import { CandidateCard } from '@/components/candidate-card';
import { CouncilBadge } from '@/components/council-benefit';
import { FoodThumb } from '@/components/food-thumb';
import { Icon, IconButton } from '@/components/icon';
import { PersonDots } from '@/components/person-dots';
import { QrCode } from '@/components/qr-code';
import { Roulette } from '@/components/roulette';
import { Text } from '@/components/text';
import { TextPieces } from '@/components/text-pieces';
import { baseFoodImageMap } from '@/hooks/use-food-images';
import { AVATARS_KEY } from '@/hooks/use-prefs';
import type { Candidate } from '@/hooks/use-session';

// 밥BTI 소개 (명세 4-30). 로그인 없이 열리고, 열기만 해서는 익명 계정이 생기지 않는다(AuthGate의 공개 주소).
// 구성은 프레즐 소개 화면(prezl.app/guide)을 따랐다: 한 줄 가치, 기능 칸, 믿음 한 줄, 다섯 단계, 시작하는 두 갈래, 자주 묻는 것, 마지막 권유, 바닥.
// 화면 조각은 실제 부품(후보 카드, 사람 동그라미, QR, 룰렛, 음식 그림)에 예시 자료를 넣어 그린다. 사람과 모임은 시연용 가상 인물이다.
// 주황은 첫 줄의 "같이" 한 곳. 단추는 검정과 회색이다 (docs/design.md "프레즐 규칙 그대로" 8절)

const WIDE_MIN = 1024;
const MAIL = 'turkiyecivciv31@gmail.com';

// 기본 음식 번호 (supabase/seed/0001_foods.sql 순서, 그림 파일 이름이 음식 번호다)
const FOOD = { kimchiStew: 1, bulgogi: 7, kalguksu: 13, tteokbokki: 17, jjajang: 21, sushi: 25, cutlet: 26, pho: 37 } as const;
// 직접 적은 메뉴의 예시 번호. 그림이 없어 회색 동그라미로 보인다
const CUSTOM_SAMPLE_ID = 9001;
const PEOPLE = ['민준', '서연', '지호'];

// 예시 조각 전용 저장소. 앱의 저장소와 나눠서 예시 값이 앱 화면에 섞이지 않고, 서버에도 묻지 않는다
function useSampleClient() {
  const [client] = useState(() => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, refetchOnMount: false, refetchOnWindowFocus: false, refetchOnReconnect: false } },
    });
    qc.setQueryData(['food-image-map'], baseFoodImageMap(Object.values(FOOD)));
    qc.setQueryData(AVATARS_KEY, {});
    return qc;
  });
  return client;
}

function sample(foodId: number, foodName: string, extra: Partial<Candidate> = {}): Candidate {
  return {
    foodId,
    foodName,
    isMine: false,
    proposedBy: '',
    blocked: false,
    pitch: null,
    vetoed: false,
    custom: false,
    aiTags: [],
    aiNotes: {},
    aiBasis: {},
    aiStatus: null,
    maybeTags: [],
    sureTags: [],
    aiChecked: true,
    ...extra,
  };
}

export default function AboutScreen() {
  const router = useRouter();
  const sampleClient = useSampleClient();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_MIN;
  const scroll = useRef<ScrollView>(null);
  const [stepsY, setStepsY] = useState(0);

  const start = () => router.replace('/' as any);
  const mail = (subject: string) =>
    Linking.openURL(`mailto:${MAIL}?subject=${encodeURIComponent(subject)}`).catch(() => undefined);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Head>
        <title>밥비티아이 소개</title>
        <meta name="description" content="오늘 뭐 먹지, 같이 정해요. 모임 사람들이 후보를 올리고 익명으로 투표한 뒤 룰렛으로 메뉴를 정해요." />
        <meta property="og:title" content="밥비티아이 소개" />
      </Head>
      <QueryClientProvider client={sampleClient}>
        <ScrollView ref={scroll} contentContainerClassName="items-center pb-16">
          <View className={`w-full gap-8 ${wide ? 'px-8' : 'px-4'}`} style={{ maxWidth: 1200 }}>
            <TopBar onBack={router.canGoBack() ? () => router.back() : null} />

            <Hero wide={wide} onStart={start} onHow={() => scroll.current?.scrollTo({ y: stepsY, animated: true })} />

            <Section title="이런 것도 돼요." wide={wide}>
              <Features wide={wide} />
            </Section>

            <Trust wide={wide} />

            <View onLayout={(e) => setStepsY(e.nativeEvent.layout.y)}>
              <Section title="다섯 단계." wide={wide}>
                <Steps wide={wide} />
              </Section>
            </View>

            <Section title="어떻게 시작할까요?" wide={wide}>
              <Grid wide={wide}>
                <StartCard
                  kicker="같이 먹을 사람이 있다면"
                  title="모임 만들기"
                  lines={['가입 없이 이름만 적으면 시작해요', '링크나 QR로 친구를 불러요', '친구는 앱이 없어도 웹에서 들어와요']}
                  action="모임 만들기"
                  onPress={start}
                />
                <StartCard
                  kicker="가게를 알리고 싶다면"
                  title="사장님 제휴"
                  lines={[
                    '메뉴가 정해진 모임에 학교 앞 가게로 보여요',
                    '직원 확인을 누른 쿠폰만 세서 실제로 온 손님만 남아요',
                    '사장님 현황판에서 받은 팀, 온 팀, 시간대를 봐요. 손님 이름은 없어요',
                  ]}
                  action="메일로 문의하기"
                  onPress={() => mail('밥비티아이 가게 제휴 문의')}
                />
              </Grid>
            </Section>

            <Section title="자주 묻는 것." wide={wide}>
              <Faq />
            </Section>

            <Closing wide={wide} onStart={start} />

            <Footer
              onTerms={() => router.push('/terms' as any)}
              onPrivacy={() => router.push('/privacy' as any)}
              onSupport={() => router.push('/support' as any)}
            />
          </View>
        </ScrollView>
      </QueryClientProvider>
    </SafeAreaView>
  );
}

// ---- 틀 ----

function TopBar({ onBack }: { onBack: (() => void) | null }) {
  return (
    <View className="h-16 flex-row items-center gap-3">
      {onBack ? <IconButton name="back" label="뒤로" onPress={onBack} /> : null}
      <Text accessibilityRole="header" className="text-2xl font-extrabold tracking-tight text-text">
        밥BTI
      </Text>
    </View>
  );
}

function Section({ title, wide, children }: { title: string; wide: boolean; children: ReactNode }) {
  return (
    <View className={`gap-6 ${wide ? 'py-8' : 'py-4'}`}>
      <Text accessibilityRole="header" className={`font-bold tracking-tight text-text ${wide ? 'text-5xl' : 'text-3xl'}`}>
        {title}
      </Text>
      {children}
    </View>
  );
}

// 노트북에서는 두 칸, 폰에서는 한 칸
function Grid({ wide, children }: { wide: boolean; children: ReactNode }) {
  return <View className={wide ? 'flex-row flex-wrap gap-4' : 'gap-4'}>{children}</View>;
}

function Cell({ wide, children }: { wide: boolean; children: ReactNode }) {
  return (
    <View className={`gap-4 rounded-2xl bg-surface ${wide ? 'p-8' : 'p-4'}`} style={wide ? { flexBasis: '48%', flexGrow: 1 } : undefined}>
      {children}
    </View>
  );
}

// 회색 칸 안에 실제 화면 조각을 놓는 흰 판
function Stage({ children }: { children: ReactNode }) {
  return <View className="gap-2 rounded-xl bg-background p-3">{children}</View>;
}

function Tag({ label }: { label: string }) {
  return (
    <View accessibilityLabel={label} className="shrink-0 self-center rounded-lg bg-surface-strong px-2">
      <Text className="text-xs font-bold text-muted">{label}</Text>
    </View>
  );
}

function DarkButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="h-14 flex-1 items-center justify-center rounded-2xl bg-ink px-6 active:opacity-80">
      <Text className="text-lg font-bold text-on-ink">{label}</Text>
    </Pressable>
  );
}

function GreyButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="h-14 flex-1 items-center justify-center rounded-2xl bg-surface px-6 active:opacity-80">
      <Text className="text-lg font-bold text-text">{label}</Text>
    </Pressable>
  );
}

// ---- 첫 칸 ----

function Hero({ wide, onStart, onHow }: { wide: boolean; onStart: () => void; onHow: () => void }) {
  const text = (
    <View className={`gap-6 ${wide ? 'flex-1 justify-center' : ''}`}>
      <View className="gap-4">
        <Text accessibilityRole="header" className={`font-bold tracking-tight text-text ${wide ? 'text-6xl' : 'text-4xl'}`}>
          오늘 뭐 먹지, <Text className="text-primary">같이</Text> 정해요.
        </Text>
        <Text className={`text-muted ${wide ? 'text-xl' : 'text-lg'}`}>후보를 올리고, 익명으로 투표하고, 룰렛으로 정해요.</Text>
      </View>
      <View className="flex-row gap-2" style={wide ? { maxWidth: 440 } : undefined}>
        <DarkButton label="바로 시작하기" onPress={onStart} />
        <GreyButton label="어떻게 하나요" onPress={onHow} />
      </View>
    </View>
  );
  const stage = (
    <View className={`gap-3 rounded-2xl bg-surface ${wide ? 'flex-1 p-8' : 'p-4'}`}>
      <GroupHead />
      <VoteSample />
    </View>
  );
  return (
    <View className={wide ? 'flex-row items-stretch gap-8 py-8' : 'gap-8 py-4'}>
      {text}
      {stage}
    </View>
  );
}

function GroupHead() {
  return (
    <View className="flex-row items-center gap-3">
      <PersonDots names={PEOPLE} size={44} />
      <View className="flex-1 gap-1">
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="text-xl font-bold tracking-tight text-text">점심 메이트</Text>
          <Tag label="가상" />
        </View>
        <Text className="text-sm text-muted">2 / 3 투표</Text>
      </View>
    </View>
  );
}

// 투표 카드. 눌러 보면 고른 표시가 바뀐다. 서버에는 아무것도 보내지 않는다
function VoteSample() {
  const [picked, setPicked] = useState<number | null>(FOOD.jjajang);
  const cards = [
    sample(FOOD.jjajang, '짜장면'),
    sample(FOOD.sushi, '초밥'),
    sample(FOOD.kimchiStew, '김치찌개', { vetoed: true }),
  ];
  return (
    <View className="gap-2">
      {cards.map((c) => (
        <CandidateCard
          key={c.foodId}
          candidate={c}
          voted={picked === c.foodId}
          onVote={() => setPicked((p) => (p === c.foodId ? null : c.foodId))}
        />
      ))}
    </View>
  );
}

// ---- 이런 것도 돼요 ----

function Features({ wide }: { wide: boolean }) {
  return (
    <Grid wide={wide}>
      <Cell wide={wide}>
        <FeatureHead kicker="익명 투표" title="누가 뭘 골랐는지는 아무도 몰라요." />
        <Stage>
          <View className="flex-row items-center gap-3">
            <PersonDots names={PEOPLE} size={44} ringClass="border-background" />
            <Text className="text-base font-bold text-text">2 / 3 투표</Text>
          </View>
          <View className="flex-row gap-2">
            <View className="h-3 flex-1 rounded-full bg-ink" />
            <View className="h-3 flex-1 rounded-full bg-ink" />
            <View className="h-3 flex-1 rounded-full bg-surface-strong" />
          </View>
        </Stage>
      </Cell>
      <Cell wide={wide}>
        <FeatureHead kicker="못 먹는 음식 미리 알림" title="못 먹는 재료가 들어가면 투표 전에 알려 줘요." />
        <Stage>
          <CandidateCard candidate={sample(FOOD.kimchiStew, '김치찌개', { vetoed: true })} />
          <CandidateCard
            candidate={sample(CUSTOM_SAMPLE_ID, '로제 떡볶이', {
              custom: true,
              aiTags: ['dairy'],
              aiNotes: { dairy: '로제 소스에 크림이 흔히 들어가요' },
              aiStatus: 'done',
              maybeTags: ['dairy'],
            })}
          />
        </Stage>
      </Cell>
      <Cell wide={wide}>
        <FeatureHead kicker="학교 앞 가게" title="메뉴가 정해지면 학교 앞 가게와 내 단과대 학생회 제휴가 보여요." />
        <Stage>
          <ShopSample />
        </Stage>
      </Cell>
      <Cell wide={wide}>
        <FeatureHead kicker="내 추천" title="내 기록으로 고른 추천은 나만 봐요." />
        <Stage>
          <View className="flex-row gap-2">
            {[
              [FOOD.kalguksu, '칼국수'],
              [FOOD.cutlet, '돈까스'],
              [FOOD.pho, '쌀국수'],
            ].map(([id, name]) => (
              <View key={id} className="flex-1 items-center gap-2 rounded-xl bg-surface p-3">
                <FoodThumb foodId={id as number} size="sm" />
                <Text className="text-center text-sm font-bold text-text">{name}</Text>
              </View>
            ))}
          </View>
        </Stage>
      </Cell>
    </Grid>
  );
}

function FeatureHead({ kicker, title }: { kicker: string; title: string }) {
  return (
    <View className="gap-1">
      <Text className="text-sm font-bold text-muted">{kicker}</Text>
      <Text className="text-xl font-bold tracking-tight text-text">{title}</Text>
    </View>
  );
}

function ShopSample() {
  return (
    <View className="flex-row items-start gap-3 rounded-2xl bg-surface p-4">
      <FoodThumb foodId={FOOD.tteokbokki} />
      <View className="flex-1 gap-1">
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="text-lg font-bold text-text">한양 분식</Text>
          <Tag label="예시" />
          <AdBadge />
          <CouncilBadge college="eng" inline />
        </View>
        <TextPieces pieces={['분식', '정문에서 걸어서 3분']} />
      </View>
    </View>
  );
}

// ---- 믿음 한 줄 ----

function Trust({ wide }: { wide: boolean }) {
  return (
    <View className={`gap-4 ${wide ? 'py-8' : 'py-4'}`}>
      <Text accessibilityRole="header" className={`font-bold tracking-tight text-text ${wide ? 'text-5xl' : 'text-3xl'}`}>
        누가 뭘 못 먹는지, 누가 뭘 골랐는지는 아무도 몰라요.
      </Text>
      <Text className={`text-muted ${wide ? 'text-xl' : 'text-lg'}`}>
        못 먹는 음식은 나만 봐요. 모임에는 &quot;못 먹는 사람이 있어요&quot;와 인원수만 보여요.
      </Text>
    </View>
  );
}

// ---- 다섯 단계 ----

const STEPS = [
  { title: '모임 만들기.', line: '링크나 QR을 보내면 친구가 이름만 적고 들어와요.' },
  { title: '후보 올리기.', line: '먹고 싶은 메뉴를 올려요. 목록에 없으면 직접 적어요.' },
  { title: '투표.', line: '고르고 싶은 만큼 골라요. 누가 뭘 골랐는지는 몰라요.' },
  { title: '룰렛.', line: '표를 많이 받은 메뉴일수록 조각이 커요.' },
  { title: '가게와 쿠폰.', line: '정해진 메뉴를 파는 학교 앞 가게와 제휴 쿠폰이 나와요.' },
] as const;

function Steps({ wide }: { wide: boolean }) {
  const [at, setAt] = useState(0);
  const list = (
    <View className={`gap-2 ${wide ? 'flex-1' : ''}`}>
      {STEPS.map((s, i) => {
        const on = i === at;
        return (
          <Pressable
            key={s.title}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${i + 1}단계 ${s.title}`}
            onPress={() => setAt(i)}
            className={`min-h-14 flex-row gap-4 rounded-2xl p-4 active:opacity-80 ${on ? 'bg-surface' : ''}`}>
            <Text className={`w-6 text-xl font-bold ${on ? 'text-text' : 'text-muted'}`}>{i + 1}</Text>
            <View className="flex-1 gap-1">
              <Text className={`text-xl font-bold tracking-tight ${on ? 'text-text' : 'text-muted'}`}>{s.title}</Text>
              {on ? <Text className="text-base text-text">{s.line}</Text> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
  const piece = (
    <View className={`justify-center rounded-2xl bg-surface ${wide ? 'flex-1 p-8' : 'p-4'}`} style={{ minHeight: 320 }}>
      <StepPiece index={at} />
    </View>
  );
  return <View className={wide ? 'flex-row items-stretch gap-8' : 'gap-4'}>{list}{piece}</View>;
}

function StepPiece({ index }: { index: number }) {
  if (index === 0) {
    return (
      <View className="items-center gap-4">
        <View className="flex-row items-center gap-2">
          <Text className="text-xl font-bold tracking-tight text-text">점심 메이트</Text>
          <Tag label="가상" />
        </View>
        <View className="rounded-2xl bg-background p-3">
          <QrCode value="https://babti.expo.app/about" size={160} />
        </View>
        <View className="flex-row items-center gap-2">
          <Icon name="link" size={16} color="muted" />
          <Text className="text-sm text-muted">링크를 보내도 돼요</Text>
        </View>
      </View>
    );
  }
  if (index === 1) {
    return (
      <Stage>
        <CandidateCard candidate={sample(FOOD.bulgogi, '불고기')} />
        <CandidateCard candidate={sample(FOOD.jjajang, '짜장면')} />
        <CandidateCard candidate={sample(FOOD.kimchiStew, '김치찌개', { vetoed: true })} />
      </Stage>
    );
  }
  if (index === 2) {
    return (
      <Stage>
        <VoteSample />
      </Stage>
    );
  }
  if (index === 3) {
    return (
      <View className="items-center gap-3">
        <Roulette
          slices={[
            { foodId: FOOD.jjajang, name: '짜장면', weight: 3 },
            { foodId: FOOD.sushi, name: '초밥', weight: 2 },
            { foodId: FOOD.bulgogi, name: '불고기', weight: 1 },
          ]}
          resultFoodId={FOOD.jjajang}
          spin={false}
          showVotes
          maxSize={240}
        />
      </View>
    );
  }
  return (
    <View className="gap-3">
      <ShopSample />
      <View className="flex-row items-center gap-3 rounded-2xl bg-background p-4">
        <Icon name="ticket" />
        <Text className="flex-1 text-base font-bold text-text">가게에서 직원 확인을 누르면 쿠폰이 써져요</Text>
      </View>
    </View>
  );
}

// ---- 시작하는 두 갈래 ----

function StartCard({
  kicker,
  title,
  lines,
  action,
  onPress,
}: {
  kicker: string;
  title: string;
  lines: readonly string[];
  action: string;
  onPress: () => void;
}) {
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_MIN;
  return (
    <Cell wide={wide}>
      <View className="gap-1">
        <Text className="text-sm font-bold text-muted">{kicker}</Text>
        <Text className="text-2xl font-bold tracking-tight text-text">{title}</Text>
      </View>
      <View className="flex-1 gap-2">
        {lines.map((l) => (
          <View key={l} className="flex-row items-start gap-2">
            <View className="pt-0.5">
              <Icon name="check" size={18} />
            </View>
            <Text className="flex-1 text-base text-text">{l}</Text>
          </View>
        ))}
      </View>
      <View className="flex-row">
        <DarkButton label={action} onPress={onPress} />
      </View>
    </Cell>
  );
}

// ---- 자주 묻는 것 ----

const FAQ = [
  {
    q: '친구가 앱이 없어도 되나요?',
    a: '네. 모임 링크나 QR을 열면 웹에서 이름만 적고 들어와요.',
  },
  {
    q: '못 먹는 음식은 누가 보나요?',
    a: '나만 봐요. 모임에는 "못 먹는 사람이 있어요"와 인원수만 보이고, 누가 적었는지는 아무에게도 보이지 않아요.',
  },
  {
    q: '돈이 드나요?',
    a: '학생은 무료예요. 앱 안에서 결제하는 것이 없어요.',
  },
  {
    q: '어디서 되나요?',
    a: '모임과 투표는 어디서나 돼요. 학교 앞 가게와 쿠폰은 지금 한양대 ERICA 앞만 있어요.',
  },
  {
    q: '내 정보는 어떻게 지우나요?',
    a: '내 프로필 맨 아래 계정 삭제를 누르면 이름, 못 먹는 음식, 밥BTI가 바로 지워져요.',
  },
] as const;

function Faq() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <View className="gap-2">
      {FAQ.map((f, i) => {
        const on = open === i;
        return (
          <Pressable
            key={f.q}
            accessibilityRole="button"
            accessibilityState={{ expanded: on }}
            accessibilityLabel={f.q}
            onPress={() => setOpen(on ? null : i)}
            className="min-h-14 gap-2 rounded-2xl bg-surface p-4 active:opacity-80">
            <View className="flex-row items-center gap-3">
              <Text className="flex-1 text-lg font-bold text-text">{f.q}</Text>
              <Icon name={on ? 'minus' : 'plus'} size={20} />
            </View>
            {on ? <Text className="text-base leading-6 text-text">{f.a}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

// ---- 마지막 권유와 바닥 ----

function Closing({ wide, onStart }: { wide: boolean; onStart: () => void }) {
  return (
    <View className={`items-center gap-6 rounded-2xl bg-surface ${wide ? 'p-8' : 'p-6'}`}>
      <Text accessibilityRole="header" className={`text-center font-bold tracking-tight text-text ${wide ? 'text-5xl' : 'text-3xl'}`}>
        오늘 점심, 지금 정해 볼까요?
      </Text>
      <View className="w-full flex-row" style={{ maxWidth: 320 }}>
        <DarkButton label="바로 시작하기" onPress={onStart} />
      </View>
    </View>
  );
}

function Footer({ onTerms, onPrivacy, onSupport }: { onTerms: () => void; onPrivacy: () => void; onSupport: () => void }) {
  return (
    <View className="gap-4 border-t border-surface-strong pt-8">
      <View className="flex-row flex-wrap gap-2">
        <FootLink label="이용약관" onPress={onTerms} />
        <FootLink label="개인정보처리방침" onPress={onPrivacy} />
        <FootLink label="문의" onPress={onSupport} />
      </View>
      <View className="gap-1">
        <Text className="text-sm text-muted">AI+X 공학융합프로젝트 01팀</Text>
        <Text className="text-sm text-muted">지도 출처 OpenStreetMap 기여자, 공공데이터포털</Text>
      </View>
    </View>
  );
}

function FootLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={label} onPress={onPress} className="h-11 justify-center pr-4 active:opacity-70">
      <Text className="text-base font-bold text-text">{label}</Text>
    </Pressable>
  );
}
