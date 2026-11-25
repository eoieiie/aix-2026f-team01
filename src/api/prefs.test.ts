import { getAvatarOptions, getMyPrefs, getVisibleAvatars, PrefsError, prefsErrorMessage, saveMyPrefs, toMyPrefs } from './prefs';

// 명세 4-27. 서버 함수(0036)만 부르고, 모르는 값은 버린다
const client = (handlers: Record<string, (args: any) => any>) =>
  ({ rpc: jest.fn(async (name: string, args: any) => handlers[name]?.(args) ?? { data: null, error: null }) }) as any;

describe('toMyPrefs', () => {
  it('서버 값을 화면 타입으로 옮긴다', () => {
    expect(
      toMyPrefs({ avatar_food_id: 3, college: 'computing', fav_cuisines: ['chinese', 'korean'], spice_level: 0, budget_level: 2, meal_times: ['lunch'] })
    ).toEqual({ avatarFoodId: 3, college: 'computing', favCuisines: ['korean', 'chinese'], spiceLevel: 0, budgetLevel: 2, mealTimes: ['lunch'] });
  });
  it('목록에 없는 값과 범위 밖 숫자는 버린다', () => {
    expect(toMyPrefs({ college: '없는대학', fav_cuisines: ['martian'], spice_level: 9, budget_level: 0, meal_times: 'lunch' })).toEqual({
      avatarFoodId: null,
      college: null,
      favCuisines: [],
      spiceLevel: null,
      budgetLevel: null,
      mealTimes: [],
    });
  });
});

describe('getMyPrefs, saveMyPrefs', () => {
  it('프로필이 없으면 null', async () => {
    expect(await getMyPrefs(client({ my_prefs: () => ({ data: null, error: null }) }))).toBeNull();
  });
  it('바뀐 칸만 p_prefs로 넘긴다', async () => {
    const c = client({ save_my_prefs: () => ({ data: { spice_level: 2 }, error: null }) });
    const saved = await saveMyPrefs({ spice_level: 2 }, c);
    expect(c.rpc).toHaveBeenCalledWith('save_my_prefs', { p_prefs: { spice_level: 2 } });
    expect(saved.spiceLevel).toBe(2);
  });
  it('서버 코드는 한국어 문구로, 그 밖의 오류는 "연결할 수 없어요"', async () => {
    const locked = client({ save_my_prefs: () => ({ data: null, error: { message: 'avatar_locked' } }) });
    await expect(saveMyPrefs({ avatar_food_id: 30 }, locked)).rejects.toBeInstanceOf(PrefsError);
    expect(prefsErrorMessage(new PrefsError('avatar_locked'))).toBe('아직 열리지 않은 아바타예요');
    expect(prefsErrorMessage(new Error('fetch failed'))).toBe('연결할 수 없어요');
  });
});

describe('아바타', () => {
  it('고를 수 있는 아바타 목록', async () => {
    const c = client({
      my_avatar_options: () => ({ data: [{ food_id: 1, name: '김치찌개', image_path: null, unlock_level: 0, eaten: false, unlocked: true }], error: null }),
    });
    expect(await getAvatarOptions(c)).toEqual([{ foodId: 1, name: '김치찌개', imageUrl: null, unlockLevel: 0, eaten: false, unlocked: true }]);
  });
  it('사람 id와 아바타 음식 id의 표. 못 받으면 빈 표(이름 첫 글자로 그린다)', async () => {
    const ok = client({ visible_avatars: () => ({ data: [{ user_id: 'u1', food_id: 5, image_path: '5.webp' }], error: null }) });
    expect(await getVisibleAvatars(ok)).toEqual({ u1: 5 });
    const fail = client({ visible_avatars: () => ({ data: null, error: { message: 'function not found' } }) });
    expect(await getVisibleAvatars(fail)).toEqual({});
  });
});
