import { qrModules } from './qr-code';

describe('초대 QR (spec.md 4-4)', () => {
  const url = 'https://babti.expo.app/g/HXZEG8';

  it('정사각형이고, 세 모서리에 위치 찾기 무늬(7칸 검은 테두리)가 있다', () => {
    const m = qrModules(url);
    const n = m.length;
    expect(n).toBeGreaterThanOrEqual(21);
    m.forEach((row) => expect(row).toHaveLength(n));
    for (const [r0, c0] of [
      [0, 0],
      [0, n - 7],
      [n - 7, 0],
    ]) {
      for (let i = 0; i < 7; i += 1) {
        expect(m[r0][c0 + i]).toBe(true);
        expect(m[r0 + 6][c0 + i]).toBe(true);
        expect(m[r0 + i][c0]).toBe(true);
        expect(m[r0 + i][c0 + 6]).toBe(true);
      }
    }
  });

  it('주소가 다르면 무늬도 다르다', () => {
    expect(qrModules(url)).not.toEqual(qrModules('https://babti.expo.app/g/ABCDEF'));
  });
});
