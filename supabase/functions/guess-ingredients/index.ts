// Edge Function guess-ingredients (명세 4-22). body {food_id}만 받는다.
// 1) 부른 사람의 JWT로 ai_ingredient_request: 직접 적은 메뉴인지, 판 참여자인지, 저장한 값, 사람별과 전체 하루 상한을 서버가 본다
// 2) 물어야 하면 Gemini에 정제한 메뉴 이름만 보낸다(8초, 안 되면 다른 모델로 한 번 더)
// 3) service role로 ai_ingredient_apply(출력 정제, 저장, 판정, 답 기록) 또는 ai_ingredient_failed(실패 이유 기록)
// 키는 Supabase Secrets의 GEMINI_API_KEY에만 있다
import { allowedOrigin, buildRequestBody, type Guess, MODELS, parseGuess, PROMPT_VERSION, TIMEOUT_MS } from './logic.ts';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GEMINI = Deno.env.get('GEMINI_API_KEY') ?? '';

function corsFor(req: Request): Record<string, string> {
  const origin = allowedOrigin(req.headers.get('Origin'));
  const base: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    Vary: 'Origin',
  };
  return origin ? { ...base, 'Access-Control-Allow-Origin': origin } : base;
}

// 답이 JSON이 아니어도 멈추지 않는다
async function rpc(name: string, args: unknown, bearer: string, apikey: string) {
  try {
    const r = await fetch(`${URL_}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${bearer}`, apikey, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    const text = await r.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    return { ok: r.ok, data };
  } catch {
    return { ok: false, data: null };
  }
}

type Answer = { ok: true; model: string; guess: Guess } | { ok: false; model: string | null; reason: string };

async function askGemini(name: string): Promise<Answer> {
  let last: Answer = { ok: false, model: null, reason: 'no_answer' };
  for (const model of MODELS) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI },
        body: JSON.stringify(buildRequestBody(name)),
        signal: ctl.signal,
      });
      if (!r.ok) {
        last = { ok: false, model, reason: `http_${r.status}` };
        continue;
      }
      try {
        return { ok: true, model, guess: parseGuess(await r.json()) };
      } catch {
        last = { ok: false, model, reason: 'parse' };
      }
    } catch (e) {
      last = { ok: false, model, reason: (e as Error)?.name === 'AbortError' ? 'timeout' : 'network' };
    } finally {
      clearTimeout(timer);
    }
  }
  return last;
}

Deno.serve(async (req) => {
  const cors = corsFor(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ error: 'no_auth' }, 401);
  let foodId: number;
  try {
    foodId = Number((await req.json())?.food_id);
  } catch {
    return json({ error: 'bad_body' }, 400);
  }
  if (!Number.isInteger(foodId) || foodId <= 0) return json({ error: 'bad_body' }, 400);

  const check = await rpc('ai_ingredient_request', { p_food_id: foodId }, jwt, ANON);
  if (!check.ok) return json({ error: 'not_allowed' }, 403);
  if (check.data?.action !== 'ask') return json({ action: check.data?.action, reason: check.data?.reason });

  const fail = async (reason: string, model: string | null) => {
    await rpc(
      'ai_ingredient_failed',
      { p_food_id: foodId, p_reason: reason, p_model: model, p_prompt_version: PROMPT_VERSION },
      SERVICE,
      SERVICE
    );
    return json({ action: 'failed', reason });
  };

  if (!GEMINI) return fail('no_key', null);
  const answer = await askGemini(String(check.data.name ?? ''));
  if (!answer.ok) return fail(answer.reason, answer.model);

  const saved = await rpc(
    'ai_ingredient_apply',
    {
      p_food_id: foodId,
      p_tags: answer.guess.tags,
      p_notes: answer.guess.notes,
      p_model: answer.model,
      p_basis: answer.guess.basis,
      p_is_menu: answer.guess.isMenu,
      p_prompt_version: PROMPT_VERSION,
      p_dropped: answer.guess.dropped,
    },
    SERVICE,
    SERVICE
  );
  // 저장에 실패하면 pending으로 10분 남지 않게 실패로 적는다
  if (!saved.ok) return fail('apply_failed', answer.model);
  return json({ action: 'done', is_menu: answer.guess.isMenu, tags: Array.isArray(saved.data) ? saved.data : [] });
});
