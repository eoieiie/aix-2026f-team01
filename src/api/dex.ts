import { getSupabase } from './supabase';
import type { Client } from './groups';
import { foodImagePublicUrl } from './food-images';
import type { DexFood, TimelineMeal } from '@/constants/dex';

// 음식 도감, 모임 식사 타임라인 (0030, 명세 4-25)
function imageUrl(path: string | null | undefined): string | null {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  return base ? foodImagePublicUrl(base, path) : null;
}

export async function getMyFoodDex(client: Client = getSupabase()): Promise<DexFood[]> {
  const { data, error } = await client.rpc('my_food_dex');
  if (error) throw error;
  return ((data ?? []) as any[]).map((r) => ({
    foodId: r.food_id,
    name: r.name,
    imageUrl: imageUrl(r.image_path),
    custom: !!r.custom,
    mealCount: r.meal_count ?? 0,
    firstEaten: r.first_eaten ?? null,
    lastEaten: r.last_eaten ?? null,
    companionCount: r.companion_count ?? 0,
  }));
}

export async function getGroupTimeline(groupId: string, client: Client = getSupabase()): Promise<TimelineMeal[]> {
  const { data, error } = await client.rpc('group_meal_timeline', { p_group_id: groupId, p_limit: 60 });
  if (error) throw error;
  return ((data ?? []) as any[]).map((r) => ({
    mealId: r.meal_id,
    foodId: r.food_id,
    foodName: r.food_name,
    cuisine: r.cuisine ?? null,
    imageUrl: imageUrl(r.image_path),
    eatenAt: r.eaten_at,
    eaters: r.eaters ?? [],
  }));
}
