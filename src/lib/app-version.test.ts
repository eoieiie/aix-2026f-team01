import { versionLabel } from './app-version';

describe('설정 아래 버전 줄', () => {
  it('받은 판의 날짜와 시각을 붙인다', () => {
    expect(versionLabel('1.0.0', new Date(2026, 10, 26, 1, 30))).toBe('버전 1.0.0, 11월 26일 01:30 판');
  });

  it('판 시각이 없으면 버전만', () => {
    expect(versionLabel('1.0.0', null)).toBe('버전 1.0.0');
    expect(versionLabel('1.0.0', new Date('없음'))).toBe('버전 1.0.0');
  });

  it('버전이 없으면 줄을 그리지 않는다', () => {
    expect(versionLabel('', null)).toBe('');
  });
});
