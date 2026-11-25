import { foodImagePublicUrl, getFoodImageMap } from './food-images';

describe('메뉴 그림 주소 (0025)', () => {
  it('버킷 안 파일 이름을 지금 서버 주소에 붙인다', () => {
    expect(foodImagePublicUrl('https://x.supabase.co/', '12.webp')).toBe(
      'https://x.supabase.co/storage/v1/object/public/food-images/12.webp'
    );
  });
  it('없거나 모양이 다르면 그림 없음', () => {
    expect(foodImagePublicUrl('https://x.supabase.co', null)).toBeNull();
    expect(foodImagePublicUrl('https://x.supabase.co', '../a.webp')).toBeNull();
    expect(foodImagePublicUrl('https://x.supabase.co', 'https://evil/1.webp')).toBeNull();
  });
});

describe('목록 칸 그림 주소 표', () => {
  const rows = [
    { id: 1, image_path: '1.webp' },
    { id: 2, image_path: '../x.webp' },
    { id: 3, image_path: null },
  ];
  const fake = (result: unknown) =>
    ({ from: () => ({ select: () => ({ not: async () => result }) }) }) as never;
  const before = process.env.EXPO_PUBLIC_SUPABASE_URL;
  beforeEach(() => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://x.supabase.co';
  });
  afterAll(() => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = before;
  });

  it('그림이 있고 이름이 바른 음식만 주소로 바꾼다', async () => {
    expect(await getFoodImageMap(fake({ data: rows, error: null }))).toEqual({
      1: 'https://x.supabase.co/storage/v1/object/public/food-images/1.webp',
    });
  });
  it('서버가 실패하면 빈 표를 준다 (화면은 색 동그라미로 그린다)', async () => {
    expect(await getFoodImageMap(fake({ data: null, error: { message: 'x' } }))).toEqual({});
    expect(
      await getFoodImageMap({
        from: () => {
          throw new Error('x');
        },
      } as never)
    ).toEqual({});
  });
});
