// 동시 접속 시험 (2026-11-21~22에 실제 서버로 돌린 코드). 결과 한 줄을 python/data/load_results.jsonl에 덧붙인다.
// 쓰는 법: EXPO_PUBLIC_SUPABASE_URL=... EXPO_PUBLIC_SUPABASE_ANON_KEY=... node scripts/load-test.mjs <인원> [모임 수] [이름]
// 예: node scripts/load-test.mjs 80 4 n80g4   (가상 계정 이름은 zz_load_로 시작하고, 시험 뒤 팀이 지운다)
// 표 다시 내기: python3 python/07_load_test.py
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) { console.error('EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY가 필요하다'); process.exit(1); }
const N = +process.argv[2]; const G = +process.argv[3] || 1; const tag = process.argv[4] || `n${N}g${G}`;
const now = () => performance.now();
const stat = (a) => { if (!a.length) return '-'; const s = [...a].sort((x, y) => x - y); const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))]; return `중앙 ${Math.round(q(0.5))}ms / 95% ${Math.round(q(0.95))}ms / 최대 ${Math.round(s[s.length - 1])}ms`; };
const res = {}; const add = (k, ok, ms, err) => { res[k] ??= { ok: 0, fail: 0, ms: [], err: {} }; if (ok) { res[k].ok++; res[k].ms.push(ms); } else { res[k].fail++; const e = String(err).slice(0, 80); res[k].err[e] = (res[k].err[e] || 0) + 1; } };
async function step(k, fn) { const t = now(); try { const r = await fn(); add(k, true, now() - t); return r; } catch (e) { add(k, false, 0, e?.message || e); return null; } }
const mk = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, realtime: { params: { eventsPerSecond: 20 } } });
const users = Array.from({ length: N }, (_, i) => ({ i, c: mk(), g: i % G }));
// 1 익명 가입 (동시)
await Promise.all(users.map(u => step('1 익명 가입', async () => { const { data, error } = await u.c.auth.signInAnonymously(); if (error) throw error; u.id = data.user.id; })));
const live = users.filter(u => u.id);
await Promise.all(live.map(u => step('2 프로필 이름', async () => { const { error } = await u.c.rpc('save_my_profile', { p_display_name: `zz_load_${u.i}`, p_handle: null, p_quiz_answers: null }); if (error) throw error; })));
// 모임: 그룹마다 첫 사람이 방장
const groups = [];
for (let g = 0; g < G; g++) { const host = live.find(u => u.g === g); if (!host) continue; host.host = true;
  const r = await step('3 모임 만들기', async () => { const { data, error } = await host.c.rpc('create_group', { p_name: `zz_load_${tag}_${g}`, p_display_name: `zz_load_${host.i}` }); if (error) throw error; return Array.isArray(data) ? data[0] : data; });
  groups[g] = { host, id: r?.group_id, code: r?.invite_code }; }
await Promise.all(live.filter(u => !u.host && groups[u.g]?.code).map(u => step('4 초대로 들어오기(동시)', async () => { const { error } = await u.c.rpc('join_group', { p_code: groups[u.g].code, p_display_name: `zz_load_${u.i}` }); if (error) throw error; })));
for (const g of groups) { if (!g?.id) continue; const size = live.filter(u => u.g === groups.indexOf(g)).length;
  g.sid = await step('5 판 열기', async () => { const { data, error } = await g.host.c.rpc('start_session', { p_group_id: g.id, p_expected_count: size <= 20 ? size : null }); if (error) throw error; return data; }); }
// 구독
await Promise.all(live.filter(u => groups[u.g]?.sid).map(u => step('6 판 참여+실시간 구독', async () => {
  const sid = groups[u.g].sid; const { error } = await u.c.rpc('join_session', { p_session_id: sid }); if (error) throw error;
  await new Promise((ok, no) => { const to = setTimeout(() => no(new Error('subscribe timeout 15s')), 15000);
    u.ch = u.c.channel(`session:${sid}:${u.i}`).on('postgres_changes', { event: '*', schema: 'public', table: 'sessions', filter: `id=eq.${sid}` }, (p) => { if (p.new?.status === 'voting' && !u.gotVoting) u.gotVoting = now(); if (p.new?.status === 'done' && !u.gotDone) u.gotDone = now(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'candidates', filter: `session_id=eq.${sid}` }, () => { u.candEvents = (u.candEvents || 0) + 1; })
      .subscribe((s, err) => { if (s === 'SUBSCRIBED') { clearTimeout(to); ok(); } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') { clearTimeout(to); no(new Error(s + ' ' + (err?.message || ''))); } }); });
})));
await new Promise(r => setTimeout(r, 1500));
// 후보: 그룹마다 앞 3명이 동시에 하나씩
await Promise.all(live.filter(u => groups[u.g]?.sid).filter((u, k, arr) => arr.filter(x => x.g === u.g).indexOf(u) < 3).map((u) => { const idx = live.filter(x => x.g === u.g).indexOf(u); return step('7 후보 올리기', async () => { const { error } = await u.c.rpc('add_candidate', { p_session_id: groups[u.g].sid, p_food_id: [1, 21, 30][idx] }); if (error) throw error; }); }));
const tv = {}; for (const g of groups) if (g?.sid) { tv[g.sid] = now(); await step('8 투표 열기', async () => { const { error } = await g.host.c.rpc('open_voting', { p_session_id: g.sid }); if (error) throw error; }); }
await new Promise(r => setTimeout(r, 3000));
// 전원 동시 투표
await Promise.all(live.filter(u => groups[u.g]?.sid).map(u => step('9 전원 동시 투표', async () => { const { error } = await u.c.rpc('cast_vote', { p_session_id: groups[u.g].sid, p_food_id: [1, 21, 30][u.i % 3] }); if (error) throw error; })));
const td = {}; for (const g of groups) if (g?.sid) { td[g.sid] = now(); await step('10 돌리기', async () => { const { error } = await g.host.c.rpc('spin_roulette', { p_session_id: g.sid }); if (error) throw error; }); }
await new Promise(r => setTimeout(r, 6000));
const subs = live.filter(u => u.ch);
const vd = subs.filter(u => u.gotVoting).map(u => u.gotVoting - tv[groups[u.g].sid]);
const dd = subs.filter(u => u.gotDone).map(u => u.gotDone - td[groups[u.g].sid]);
const out = { N, G, tag, steps: Object.fromEntries(Object.entries(res).map(([k, v]) => [k, `성공 ${v.ok}/${v.ok + v.fail}, ${stat(v.ms)}${Object.keys(v.err).length ? ', 오류 ' + JSON.stringify(v.err) : ''}`])),
  realtime: { 구독: subs.length, '투표 열림 신호 받음': `${vd.length}/${subs.length}, ${stat(vd)}`, '결과 신호 받음': `${dd.length}/${subs.length}, ${stat(dd)}` } };
console.log(JSON.stringify(out, null, 1));
fs.appendFileSync(new URL('../python/data/load_results.jsonl', import.meta.url), JSON.stringify(out) + '\n');
for (const u of subs) try { await u.c.removeChannel(u.ch); } catch {}
process.exit(0);
