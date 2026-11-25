import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { Platform } from 'react-native';

export const SUPPORT_MAIL = 'turkiyecivciv31@gmail.com';

export function browserLabel(userAgent: string) {
  // 브라우저 이름과 주 버전만 보낸다. 원래 사용자 에이전트 문장은 보내지 않는다.
  const choices: [string, RegExp][] = [
    ['Edge', /Edg(?:A|iOS)?\/(\d+)/],
    ['Opera', /(?:OPR|OPiOS)\/(\d+)/],
    ['삼성 인터넷', /SamsungBrowser\/(\d+)/],
    ['Firefox', /(?:Firefox|FxiOS)\/(\d+)/],
    ['Chrome', /(?:Chrome|CriOS)\/(\d+)/],
    ['Safari', /Version\/(\d+).*Safari\//],
  ];
  for (const [name, pattern] of choices) {
    const version = userAgent.match(pattern)?.[1];
    if (version) return `${name} ${version}`;
  }
  return '알 수 없는 브라우저';
}

export function supportMailUrl(): `mailto:${string}` {
  const web = Platform.OS === 'web';
  const version = Constants.expoConfig?.version ?? '알 수 없음';
  const updateId = web ? '해당 없음' : (Updates.updateId ?? '없음');
  const device = web
    ? browserLabel(typeof navigator === 'undefined' ? '' : navigator.userAgent)
    : Platform.OS === 'android'
      ? `안드로이드 ${Platform.constants.Release}`
      : `iOS ${Platform.Version}`;
  const body = [
    '',
    '',
    '',
    '문제를 찾는 데 쓰려고 아래 정보를 함께 보내요.',
    `앱 판: ${version} (업데이트 ID: ${updateId})`,
    `기기: ${device}`,
  ].join('\r\n');
  return `mailto:${SUPPORT_MAIL}?subject=${encodeURIComponent('[밥BTI] 문의')}&body=${encodeURIComponent(body)}`;
}
