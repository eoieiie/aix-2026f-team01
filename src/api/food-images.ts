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

// 그림이 있는 음식의 주소를 한 번에 받는다. 목록 칸 왼쪽 그림에 쓴다 (docs/design.md "화면 규칙").
// 실패하면 빈 표를 돌려준다. 화면은 그림 대신 색 동그라미로 그린다
export async function getFoodImageMap(client: Client = getSupabase()): Promise<Record<number, string>> {
  try {
    const { data, error } = await client.from('foods').select('id, image_path').not('image_path', 'is', null);
    const base = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
    if (error || !data || !base) return {};
    const out: Record<number, string> = {};
    for (const row of data as { id: number; image_path: string | null }[]) {
      const url = foodImagePublicUrl(base, row.image_path);
      if (url) out[row.id] = url;
    }
    return out;
  } catch {
    return {};
  }
}
