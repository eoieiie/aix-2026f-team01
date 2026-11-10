/// <reference types="node" />
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

import {
  DISPLAY_NAME_MAX,
  FOOD_NAME_MAX,
  GROUP_NAME_MAX,
  HANDLE_MAX,
  HANDLE_MIN,
  INVITE_CODE_LENGTH,
  MAX_VOTES_PER_PERSON,
  PITCH_MAX,
  QUIZ_LENGTH,
} from '@/constants';

const app: Record<string, number> = {
  DISPLAY_NAME_MAX,
  FOOD_NAME_MAX,
  GROUP_NAME_MAX,
  HANDLE_MAX,
  HANDLE_MIN,
  INVITE_CODE_LENGTH,
  MAX_VOTES_PER_PERSON,
  PITCH_MAX,
  QUIZ_LENGTH,
};

// 서버 규칙 숫자(supabase/migrations의 app_limits)가 앱 상수와 같은지 (spec.md 3절 4번).
// 나중 migration이 다시 정의하면 그 값이 서버 값이다
function readServerLimits(): Record<string, number> {
  const dir = join(__dirname, '../../supabase/migrations');
  const sql = readdirSync(dir)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => readFileSync(join(dir, file), 'utf8'))
    .join('\n');
  const matches = [...sql.matchAll(/function public\.app_limits\(\)[\s\S]*?'(\{[^']*\})'::jsonb/g)];
  const last = matches[matches.length - 1];
  if (!last) throw new Error('migration에서 app_limits를 찾지 못했다');
  return JSON.parse(last[1]);
}

describe('서버 규칙 숫자', () => {
  const server = readServerLimits();

  it.each(Object.keys(server))('%s가 앱 상수와 같다', (key) => {
    expect(app[key]).toBe(server[key]);
  });

  it('서버가 쓰는 숫자를 빠짐없이 비교한다', () => {
    expect(Object.keys(server).sort()).toEqual(Object.keys(app).sort());
  });
});
