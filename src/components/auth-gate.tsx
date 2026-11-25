import { usePathname, useRouter } from 'expo-router';
import { type ReactNode, useEffect } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Text } from '@/components/text';

import { isPublicPath } from '@/constants/public-paths';
import { useAnonymousAuth } from '@/hooks/use-anonymous-auth';
import { useMyProfile } from '@/hooks/use-profile';

// 익명 로그인이 끝나야 안쪽 화면을 보여준다 (spec.md 4-1).
// 소개, 처리방침, 약관, 문의는 로그인 없이 바로 보인다. 열기만 해서는 익명 계정이 생기지 않고,
// 거기서 앱 화면(/)으로 가면 그때 로그인한다 (4-30)
export function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const open = isPublicPath(pathname);
  const { status, retry, retrying } = useAnonymousAuth({ enabled: !open });

  if (!open && status === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator accessibilityLabel="연결하는 중" />
      </View>
    );
  }

  if (!open && status === 'error') {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-background px-6">
        <Text className="text-lg font-semibold text-text">연결할 수 없어요</Text>
        <Pressable
          accessibilityRole="button"
          disabled={retrying}
          onPress={retry}
          className="rounded-xl bg-primary px-6 py-3 disabled:opacity-50">
          <Text className="font-semibold text-on-primary">
            {retrying ? '다시 연결하는 중' : '다시 시도'}
          </Text>
        </Pressable>
      </View>
    );
  }

  // 공개 주소에서도 같은 자리에 children을 둔다. 자리가 바뀌면 Stack이 새로 그려져 앱 안에서 뒤로 가기가 끊긴다
  return (
    <>
      {open ? null : <OnboardingRedirect />}
      {children}
    </>
  );
}

// 프로필이 없는 사람(이름도 적은 적 없는 새 사람)은 온보딩으로 보낸다 (spec.md 4-14, 7절). 보내는 곳은 여기 한 군데.
// 홈(/)을 열 때만 보낸다. 초대 링크로 들어온 사람은 이름을 적을 때 프로필이 생기고, 모임과 판 화면은 소속이어야 보여서
// 그 화면에서 보낼 일이 없다. 다른 주소에서도 보내면 막 참여한 사람이 저장된 옛 값(프로필 없음) 때문에 잘못 끌려갈 수 있다
function OnboardingRedirect() {
  const pathname = usePathname();
  const router = useRouter();
  const profile = useMyProfile();
  const { refetch } = profile;

  // 다른 화면에서 이름을 적고(모임 만들기, 초대 참여) 홈으로 오면 다시 읽는다
  useEffect(() => {
    if (pathname === '/') refetch();
  }, [pathname, refetch]);

  useEffect(() => {
    if (pathname !== '/' || profile.isFetching || !profile.isSuccess) return;
    if (profile.data === null) router.replace('/onboarding' as any);
  }, [pathname, profile.isFetching, profile.isSuccess, profile.data, router]);

  return null;
}
