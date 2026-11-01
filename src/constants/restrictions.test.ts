/// <reference types="node" />
import { readFileSync } from 'fs';
import { join } from 'path';

import { DIET_TAGS, INGREDIENT_TAGS, RESTRICTION_KINDS } from '@/constants/restrictions';

// 앱의 태그·이유 코드가 서버(supabase/migrations/0001_schema.sql)와 같은지 (spec.md 3절 4번, 4-7)
const sql = readFileSync(join(__dirname, '../../supabase/migrations/0001_schema.sql'), 'utf8');

function serverArray(fn: string): string[] {
  const match = sql.match(new RegExp(`function public\\.${fn}\\(\\)[\\s\\S]*?array\\[([^\\]]*)\\]`));
  if (!match) throw new Error(`0001_schema.sql에서 ${fn}을 찾지 못했다`);
  return match[1].split(',').map((s) => s.trim().replace(/'/g, ''));
}

describe('못 먹는 것 코드', () => {
  it('재료 태그 8개가 서버 ingredient_tags와 같다', () => {
    expect(INGREDIENT_TAGS.map((t) => t.code)).toEqual(serverArray('ingredient_tags'));
  });

  it('식단 태그 3개가 서버 diet_tags와 같다', () => {
    expect(DIET_TAGS.map((t) => t.code)).toEqual(serverArray('diet_tags'));
  });

  it('이유 3개가 서버 restrictions.kind 제약과 같다', () => {
    const match = sql.match(/kind text not null check \(kind in \(([^)]*)\)\)/);
    if (!match) throw new Error('0001_schema.sql에서 restrictions.kind 제약을 찾지 못했다');
    const server = match[1].split(',').map((s) => s.trim().replace(/'/g, ''));
    expect(RESTRICTION_KINDS.map((k) => k.code)).toEqual(server);
  });
});
