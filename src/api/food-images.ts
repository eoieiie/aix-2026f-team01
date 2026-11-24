import { getSupabase } from './supabase';
import type { Client } from './groups';

// 메뉴 그림 (0025). foods.image_path는 버킷 안 파일 이름만이다. 주소는 지금 연결된 Supabase 주소로 만든다
export const FOOD_IMAGE_BUCKET = 'food-images';

export function foodImagePublicUrl(baseUrl: string, path: string | null | undefined): string | null {
  if (!path || !/^[0-9]+\.(webp|png)$/.test(path)) return null;
  return `${baseUrl.replace(/\/+$/, '')}/storage/v1/object/public/${FOOD_IMAGE_BUCKET}/${path}`;
}

// 실패하거나(서버에 칸이 아직 없음 등) 그림이 없으면 null. 결과 화면은 그림 없이 그대로 간다
export async function getFoodImageUrl(foodId: number, client: Client = getSupabase()): Promise<string | null> {
  try {
    const { data, error } = await client.from('foods').select('image_path').eq('id', foodId).maybeSingle();
    if (error) return null;
    const base = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
    return base ? foodImagePublicUrl(base, (data as { image_path?: string | null } | null)?.image_path) : null;
  } catch {
    return null;
  }
}
