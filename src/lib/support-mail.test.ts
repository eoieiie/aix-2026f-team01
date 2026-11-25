import { Platform } from 'react-native';
import { browserLabel, supportMailUrl } from './support-mail';

jest.mock('expo-constants', () => ({ expoConfig: { version: '1.2.3' } }));
jest.mock('expo-updates', () => ({ updateId: '시험-업데이트' }));

const originalPlatform = Platform.OS;
afterEach(() => { Platform.OS = originalPlatform; });

test.each([
  ['Chrome/146.0 Safari/537.36 Edg/146.1', 'Edge 146'],
  ['Chrome/146.0 Mobile Safari/537.36 SamsungBrowser/29.0', '삼성 인터넷 29'],
  ['Version/26.1 Mobile Safari/604.1', 'Safari 26'],
  ['FxiOS/145.0 Mobile Safari/604.1', 'Firefox 145'],
  ['알 수 없는 브라우저 식별 문자열', '알 수 없는 브라우저'],
])('원래 브라우저 정보 대신 이름과 주 버전만 남긴다 (%s)', (ua, expected) => {
  expect(browserLabel(ua)).toBe(expected);
});

test('메일 제목과 본문에 진단 줄만 채운다', () => {
  Platform.OS = 'ios';
  const url = new URL(supportMailUrl());
  expect(url.pathname).toBe('turkiyecivciv31@gmail.com');
  expect(url.searchParams.get('subject')).toBe('[밥BTI] 문의');
  expect(url.searchParams.get('body')).toBe([
    '', '', '',
    '문제를 찾는 데 쓰려고 아래 정보를 함께 보내요.',
    '앱 판: 1.2.3 (업데이트 ID: 시험-업데이트)',
    `기기: iOS ${Platform.Version}`,
  ].join('\r\n'));
});

test('웹 메일에는 앱 업데이트 ID를 넣지 않는다', () => {
  Platform.OS = 'web';
  const body = new URL(supportMailUrl()).searchParams.get('body');
  expect(body).toContain('앱 판: 1.2.3 (업데이트 ID: 해당 없음)');
  expect(body).not.toContain('시험-업데이트');
});
