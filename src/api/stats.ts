import { getSupabase } from './supabase';
import type { Client } from './groups';
import { typeCode } from './profile';

// 내 프로필(4-15)에 쓰는 숫자. 서버 함수는 0006(my_food_counts, my_companions)

export interface MyProfile {
  displayName: string | null;
  handle: string | null;
  // 축 점수. 네 글자를 만든 적이 없으면 null (4-14)
  axes: Record<string, number> | null;
}

export interface FoodCount {
  foodId: number;
  name: string;
  mealCount: number;
}

export interface Companion {
  userId: string;
  displayName: string;
  mealCount: number;
}

export interface MyStats {
  profile: MyProfile;
  foods: FoodCount[];
  companions: Companion[];
}

export async function getMyStats(client: Client = getSupabase()): Promise<MyStats> {
  const { data: auth, error: authError } = await client.auth.getSession();
  if (authError) throw authError;
  const userId = auth.session?.user?.id;

  const [profileRes, countsRes, companionsRes] = await Promise.all([
    userId
      ? client.from('profiles').select('display_name, handle, axes').eq('user_id', userId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    client.rpc('my_food_counts'),
    client.rpc('my_companions'),
  ]);
  for (const res of [profileRes, countsRes, companionsRes] as any[]) {
    if (res.error) throw res.error;
  }

  const counts: { food_id: number; meal_count: number }[] = (countsRes as any).data ?? [];
  // 음식 이름은 따로 읽는다. 직접 적은 메뉴도 내가 있던 판의 것이라 권한상 보인다 (4-9)
  const ids = counts.map((c) => c.food_id);
  const names = new Map<number, string>();
  if (ids.length > 0) {
    const { data, error } = await client.from('foods').select('id, name').in('id', ids);
    if (error) throw error;
    for (const f of data ?? []) names.set((f as any).id, (f as any).name);
  }

  const p: any = (profileRes as any).data;
  return {
    profile: {
      displayName: p?.display_name ?? null,
      handle: p?.handle ?? null,
      axes: p?.axes && Object.keys(p.axes).length > 0 ? p.axes : null,
    },
    foods: counts.map((c) => ({ foodId: c.food_id, name: names.get(c.food_id) ?? '', mealCount: c.meal_count })),
    companions: ((companionsRes as any).data ?? []).map((c: any) => ({
      userId: c.user_id,
      displayName: c.display_name ?? '',
      mealCount: c.meal_count,
    })),
  };
}

// 레벨: 삼각수(1, 3, 6, 10…끼). 총 끼니가 n(n+1)/2 이상인 가장 큰 n. 다음 레벨까지 남은 끼니 (4-15)
export function levelOf(totalMeals: number): { level: number; toNext: number } {
  const t = Math.max(0, Math.floor(totalMeals));
  let n = Math.floor((Math.sqrt(8 * t + 1) - 1) / 2);
  while (((n + 1) * (n + 2)) / 2 <= t) n += 1;
  while (n > 0 && (n * (n + 1)) / 2 > t) n -= 1;
  return { level: n, toNext: ((n + 1) * (n + 2)) / 2 - t };
}

// 같은 음식을 3번 이상 먹었으면 "OO 권위자". 가장 많이 먹은 것, 같으면 food_id가 작은 것 (4-15)
export function authorityTitle(foods: FoodCount[]): string | null {
  const top = foods
    .filter((f) => f.mealCount >= 3 && f.name)
    .sort((a, b) => b.mealCount - a.mealCount || a.foodId - b.foodId)[0];
  return top ? `${top.name} 권위자` : null;
}

// 네 글자 칸에 한 글자씩. 만드는 규칙은 온보딩(#40)의 typeCode 하나만 쓴다
export function typeLetters(axes: Record<string, number>): string[] {
  return Array.from(typeCode(axes as any) ?? '');
}
