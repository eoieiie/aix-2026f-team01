import type { ReactNode } from 'react';
import { Image, View } from 'react-native';

import { Button } from '@/components/button';
import { Icon, type IconName } from '@/components/icon';
import { Text } from '@/components/text';

const mascotSource = require('../../assets/images/mascot.png');

type Action = {
  label: string;
  onPress: () => void;
  // 할 일이 화면의 주 단추면 주황, 다시 시도나 다른 곳으로 가기는 회색 면 위 흰 단추
  variant?: 'primary' | 'inverse';
  loading?: boolean;
};

// 빈 화면과 오류 화면은 모두 이 모양 하나다 (docs/design.md "화면 검수 2"):
// 회색 카드 안에 그림(마스코트) 또는 아이콘 하나, 왜 비었는지 한 줄, 다음 할 일 단추 하나.
// 아이콘을 주지 않으면 마스코트가 나온다. 연결 문제는 refresh, 쿠폰은 ticket처럼 내용에 맞는 아이콘을 준다
export function EmptyState({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon?: IconName;
  action?: Action;
  // 단추 아래 글자 고리 하나(홈의 "어떻게 하나요")만 둔다
  children?: ReactNode;
}) {
  return (
    <View className="w-full items-center gap-4 rounded-3xl bg-surface p-6">
      {icon ? (
        <View className="h-14 w-14 items-center justify-center rounded-full bg-background">
          <Icon name={icon} size={28} color="muted" />
        </View>
      ) : (
        <Image source={mascotSource} style={{ width: 64, height: 49 }} resizeMode="contain" accessibilityLabel="밥BTI 마스코트" />
      )}
      <Text className="text-center text-xl font-bold tracking-tight text-text">{title}</Text>
      {action ? (
        <Button
          label={action.label}
          variant={action.variant ?? 'primary'}
          loading={action.loading}
          className="self-center px-8"
          onPress={action.onPress}
        />
      ) : null}
      {children}
    </View>
  );
}

// 화면 전체가 빈 화면일 때(판이 닫힘, 멤버 아님, 연결 끊김): 같은 카드를 화면 가운데에, 옆 여백 16
export function EmptyScreen(props: Parameters<typeof EmptyState>[0]) {
  return (
    <View className="flex-1 justify-center bg-background px-4">
      <View className="w-full max-w-[480px] self-center">
        <EmptyState {...props} />
      </View>
    </View>
  );
}
