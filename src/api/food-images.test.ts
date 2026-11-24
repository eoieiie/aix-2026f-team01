import { foodImagePublicUrl } from './food-images';

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
