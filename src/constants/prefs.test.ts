/// <reference types="node" />
import { readFileSync } from 'fs';
import { join } from 'path';

import {
  AVATAR_STARTER_COUNT,
  type AvatarOption,
  COLLEGES,
  CUISINES,
  EMPTY_PREFS,
  MEAL_TIMES,
  SPICE_LEVELS,
  BUDGET_LEVELS,
  collegeLabel,
  nextAvatarUnlock,
  prefsPatch,
  sortAvatarOptions,
  toggleIn,
} from './prefs';

// 명세 4-27. 고를 수 있는 값은 서버 0036과 같아야 한다
const sql = readFileSync(join(__dirname, '../../supabase/migrations/0036_profile_prefs.sql'), 'utf8');
function serverList(fn: string): string[] {
  const body = sql.slice(sql.indexOf(`function public.${fn}()`));
  const m = /select array\[([^\]]*)\]/.exec(body);
  return (m?.[1] ?? '').split(',').map((x) => x.trim().replace(/'/g, ''));
}

describe('서버와 같은 값 (0036)', () => {
  it('좋아하는 종류', () => expect(CUISINES.map((c) => c.key)).toEqual(serverList('pref_cuisines')));
  it('단과대 10곳', () => {
    expect(COLLEGES.map((c) => c.key)).toEqual(serverList('pref_colleges'));
    expect(COLLEGES).toHaveLength(10);
  });
  it('주로 먹는 때', () => expect(MEAL_TIMES.map((c) => c.key)).toEqual(serverList('pref_meal_times')));
  it('매운맛은 0~3, 예산은 1~3', () => {
    expect(SPICE_LEVELS.map((s) => s.value)).toEqual([0, 1, 2, 3]);
    expect(BUDGET_LEVELS.map((s) => s.value)).toEqual([1, 2, 3]);
    expect(sql).toContain('spice_level between 0 and 3');
    expect(sql).toContain('budget_level between 1 and 3');
  });
  it('처음 열린 아바타 수', () => {
    const body = sql.slice(sql.indexOf('function public.avatar_starter_count()'));
    expect(Number(/select (\d+)/.exec(body)?.[1])).toBe(AVATAR_STARTER_COUNT);
  });
});

describe('collegeLabel', () => {
  it('키로 이름을 찾고, 모르는 값은 null', () => {
    expect(collegeLabel('computing')).toBe('소프트웨어융합대학');
    expect(collegeLabel('없는값')).toBeNull();
    expect(collegeLabel(null)).toBeNull();
  });
});

describe('toggleIn', () => {
  const order = ['korean', 'chinese', 'japanese'] as const;
  it('없으면 넣고 있으면 뺀다. 순서는 목록 순서', () => {
    expect(toggleIn(['japanese'], 'korean', order)).toEqual(['korean', 'japanese']);
    expect(toggleIn(['korean', 'japanese'], 'korean', order)).toEqual(['japanese']);
  });
});

const opt = (foodId: number, unlockLevel: number, unlocked: boolean, eaten = false): AvatarOption => ({
  foodId,
  name: `음식${foodId}`,
  imageUrl: null,
  unlockLevel,
  eaten,
  unlocked,
});

describe('아바타', () => {
  const options = [opt(1, 0, true), opt(7, 1, true), opt(8, 2, false), opt(9, 3, true, true), opt(10, 4, false)];
  it('다음에 열리는 것은 아직 안 열린 것 중 가장 낮은 레벨', () => {
    expect(nextAvatarUnlock(options)?.foodId).toBe(8);
  });
  it('다 열렸으면 없다', () => {
    expect(nextAvatarUnlock([opt(1, 0, true)])).toBeNull();
  });
  it('고르는 창은 열린 것 먼저, 잠긴 것은 열리는 레벨 순', () => {
    expect(sortAvatarOptions(options).map((o) => o.foodId)).toEqual([1, 7, 9, 8, 10]);
  });
});

describe('prefsPatch', () => {
  it('바뀐 칸만 보낸다', () => {
    const after = { ...EMPTY_PREFS, spiceLevel: 1, favCuisines: ['korean' as const] };
    expect(prefsPatch(EMPTY_PREFS, after)).toEqual({ spice_level: 1, fav_cuisines: ['korean'] });
  });
  it('지운 칸은 null로 보낸다(말하지 않기)', () => {
    const before = { ...EMPTY_PREFS, college: 'eng' as const, avatarFoodId: 3 };
    expect(prefsPatch(before, { ...before, college: null, avatarFoodId: null })).toEqual({ college: null, avatar_food_id: null });
  });
  it('바뀐 것이 없으면 null', () => {
    expect(prefsPatch(EMPTY_PREFS, { ...EMPTY_PREFS })).toBeNull();
  });
});
