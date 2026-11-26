import { usePathname, useRouter } from 'expo-router';
import { type ReactNode, useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { EmptyScreen } from '@/components/empty-state';

import { isPublicPath } from '@/constants/public-paths';
import { isFirstWebVisit } from '@/lib/first-visit';
import { useAnonymousAuth } from '@/hooks/use-anonymous-auth';
import { useMyProfile } from '@/hooks/use-profile';

// 익명 로그인이 끝나야 안쪽 화면을 보여준다 (spec.md 4-1).
// 소개, 처리방침, 약관, 문의는 로그인 없이 바로 보인다. 열기만 해서는 익명 계정이 생기지 않고,
// 거기서 앱 화면(/)으로 가면 그때 로그인한다 (4-30). 웹 첫 방문의 루트(/)도 소개로 넘어가기 전까지는 같다
export function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // 웹에 처음 온 사람이 루트를 열면 계정을 만들지 않고 둔다. 탭 레이아웃이 소개(/about)로 보낸다 (4-30, 2026-11-26)
  const open = isPublicPath(pathname) || isFirstWebVisit(pathname);
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
      <EmptyScreen title="연결할 수 없어요" icon="refresh" action={{ label: '다시 시도', variant: 'inverse', onPress: retry, loading: retrying }} />
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
