/// <reference types="node" />
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

import { DIET_TAGS, INGREDIENT_TAGS } from '@/constants/restrictions';

// 앱의 태그 코드가 서버(supabase/migrations)와 같은지 (spec.md 3절 4번, 4-7).
// 나중 migration이 다시 정의하면 그 값이 서버 값이다 (재료 태그는 0007에서 달걀이 더해졌다)
const dir = join(__dirname, '../../supabase/migrations');
const sql = readdirSync(dir)
  .filter((file) => file.endsWith('.sql'))
  .sort()
  .map((file) => readFileSync(join(dir, file), 'utf8'))
  .join('\n');

function serverArray(fn: string): string[] {
  const matches = [...sql.matchAll(new RegExp(`function public\\.${fn}\\(\\)[\\s\\S]*?array\\[([^\\]]*)\\]`, 'g'))];
  const last = matches[matches.length - 1];
  if (!last) throw new Error(`migration에서 ${fn}을 찾지 못했다`);
  return last[1].split(',').map((s) => s.trim().replace(/'/g, ''));
}

describe('못 먹는 것 코드', () => {
  it('재료 태그 9개가 서버 ingredient_tags와 같다', () => {
    expect(INGREDIENT_TAGS.map((t) => t.code)).toEqual(serverArray('ingredient_tags'));
  });

  it('식단 태그 3개가 서버 diet_tags와 같다', () => {
    expect(DIET_TAGS.map((t) => t.code)).toEqual(serverArray('diet_tags'));
  });

  it('서버 restrictions 표에 이유 칸이 남아 있지 않다 (0007에서 지운다)', () => {
    expect(sql).toMatch(/alter table public\.restrictions drop column if exists kind/);
  });
});
