/// <reference types="node" />
import { readFileSync } from 'fs';
import { join } from 'path';

import {
  DISPLAY_NAME_MAX,
  GROUP_NAME_MAX,
  INVITE_CODE_LENGTH,
  MAX_VOTES_PER_PERSON,
  PITCH_MAX,
} from '@/constants';

const app: Record<string, number> = {
  DISPLAY_NAME_MAX,
  GROUP_NAME_MAX,
  INVITE_CODE_LENGTH,
  MAX_VOTES_PER_PERSON,
  PITCH_MAX,
};

// 서버 규칙 숫자(supabase/migrations/0001_schema.sql의 app_limits)가 앱 상수와 같은지 (spec.md 3절 4번)
function readServerLimits(): Record<string, number> {
  const sql = readFileSync(join(__dirname, '../../supabase/migrations/0001_schema.sql'), 'utf8');
  const match = sql.match(/function public\.app_limits\(\)[\s\S]*?'(\{[^']*\})'::jsonb/);
  if (!match) throw new Error('0001_schema.sql에서 app_limits를 찾지 못했다');
  return JSON.parse(match[1]);
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
