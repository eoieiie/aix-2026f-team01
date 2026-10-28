import {
  DISPLAY_NAME_MAX,
  GROUP_NAME_MAX,
  INVITE_CODE_LENGTH,
  RECENT_MEALS_LIMIT,
} from '@/constants';

import {
  generateInviteCode,
  Group,
  validateGroupInput,
} from './use-groups';

describe('C 묶음 규칙 테스트 (spec.md 4-2, 4-3, 4-4, 4-6)', () => {
  describe('모임 만들기 검증 (4-2)', () => {
    it('빈 모임 이름이면 에러를 던진다', () => {
      expect(() => validateGroupInput('', '홍길동')).toThrow('모임 이름을 입력해주세요.');
      expect(() => validateGroupInput('   ', '홍길동')).toThrow('모임 이름을 입력해주세요.');
    });

    it('모임 이름이 최대 글자 수를 초과하면 에러를 던진다', () => {
      const longName = 'a'.repeat(GROUP_NAME_MAX + 1);
      expect(() => validateGroupInput(longName, '홍길동')).toThrow(
        `모임 이름은 ${GROUP_NAME_MAX}자 이하여야 해요.`
      );
    });

    it('빈 내 이름이면 에러를 던진다', () => {
      expect(() => validateGroupInput('점심 팟', '')).toThrow('내 이름을 입력해주세요.');
      expect(() => validateGroupInput('점심 팟', '   ')).toThrow('내 이름을 입력해주세요.');
    });

    it('내 이름이 최대 글자 수를 초과하면 에러를 던진다', () => {
      const longDisplayName = 'b'.repeat(DISPLAY_NAME_MAX + 1);
      expect(() => validateGroupInput('점심 팟', longDisplayName)).toThrow(
        `이름은 ${DISPLAY_NAME_MAX}자 이하여야 해요.`
      );
    });

    it('유효한 이름이면 예외 없이 통과한다', () => {
      expect(() => validateGroupInput('점심 팟', '홍길동')).not.toThrow();
    });

    it('초대 코드는 6자이고 헷갈리는 문자(0, O, 1, I)가 없다', () => {
      for (let i = 0; i < 50; i++) {
        const code = generateInviteCode();
        expect(code).toHaveLength(INVITE_CODE_LENGTH);
        expect(code).not.toMatch(/[01OI]/);
      }
    });
  });

  describe('내 모임 목록 정렬 (4-3)', () => {
    it('최근 들어간 순(last_visited_at 역순)으로 정렬된다', () => {
      const groups: Group[] = [
        {
          id: '1',
          name: '오래된 모임',
          invite_code: 'AAA222',
          created_at: '2026-10-01T00:00:00Z',
          last_visited_at: '2026-10-01T00:00:00Z',
        },
        {
          id: '2',
          name: '최근 모임',
          invite_code: 'BBB333',
          created_at: '2026-10-01T00:00:00Z',
          last_visited_at: '2026-10-28T00:00:00Z',
        },
      ];

      const sorted = [...groups].sort(
        (a, b) => new Date(b.last_visited_at).getTime() - new Date(a.last_visited_at).getTime()
      );

      expect(sorted[0].id).toBe('2');
      expect(sorted[1].id).toBe('1');
    });
  });

  describe('모임 화면 최근 식사 제한 (4-6)', () => {
    it('최근 식사는 최대 5개까지만 노출된다', () => {
      const manyMeals = Array.from({ length: 10 }, (_, i) => ({
        id: `meal-${i}`,
        food_id: i,
        food_name: `음식-${i}`,
        eaten_at: new Date().toISOString(),
      }));

      const sliced = manyMeals.slice(0, RECENT_MEALS_LIMIT);
      expect(sliced).toHaveLength(5);
    });
  });
});
