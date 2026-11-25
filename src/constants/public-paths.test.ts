import { isPublicPath } from './public-paths';

describe('로그인 없이 여는 주소', () => {
  it('소개, 처리방침, 약관, 문의는 익명 계정을 만들지 않는다', () => {
    for (const p of ['/about', '/about/', '/privacy', '/terms', '/support']) expect(isPublicPath(p)).toBe(true);
  });

  it('앱 화면은 그대로 로그인한다', () => {
    for (const p of ['/', '/onboarding', '/groups/1', '/g/ABC123', '/profile', '/about-us', '/aboutx', '', null]) {
      expect(isPublicPath(p)).toBe(false);
    }
  });
});
