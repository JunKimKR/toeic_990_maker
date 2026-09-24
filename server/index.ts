/**
 * Portable backend (Fetch API handler): runs on Node (server/dev.ts), or any
 * platform that speaks Request/Response (Vercel/Netlify functions, Deno Deploy,
 * Cloudflare Workers with node compat).
 *
 *   GET  /v1/health
 *   POST /v1/generate   { specs: GenSpec[], avoid: { reasoningPaths, topics } }
 *   GET  /v1/tts?voice=M-us&rate=1&text=...
 *
 * All secrets (ANTHROPIC_API_KEY, OPENAI_API_KEY, ...) live here, never in the app.
 */
import { createProvider, LlmProvider, LlmRefusalError } from './llm';
import { generateOne, GenSpec } from './generate';
import { createTtsProvider, LruCache, ServerTts } from './tts';

export interface HandlerDeps {
  llm?: LlmProvider | null;
  critic?: LlmProvider | null;
  tts?: ServerTts | null;
  appToken?: string;
  maxSpecsPerRequest?: number;
  ratePerMinute?: number;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });

export function createHandler(deps: HandlerDeps = {}) {
  const llm = deps.llm === undefined ? createProvider() : deps.llm;
  const critic = deps.critic === undefined ? llm : deps.critic;
  const tts = deps.tts === undefined ? createTtsProvider() : deps.tts;
  const appToken = deps.appToken ?? process.env.APP_TOKEN ?? '';
  const maxSpecs = deps.maxSpecsPerRequest ?? Number(process.env.MAX_SPECS_PER_REQUEST ?? 6);
  const rate = deps.ratePerMinute ?? Number(process.env.RATE_PER_MINUTE ?? 20);
  const ttsCache = new LruCache<ArrayBuffer>(800);
  const hits = new Map<string, number[]>();

  const limited = (key: string) => {
    const now = Date.now();
    const arr = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
    arr.push(now);
    hits.set(key, arr);
    return arr.length > rate;
  };

  return async function handle(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type, x-app-token', 'access-control-allow-methods': 'GET, POST' } });
    if (url.pathname === '/v1/health') return json({ ok: true, provider: llm?.name ?? 'none', tts: tts?.name ?? 'none' });
    if (appToken && req.headers.get('x-app-token') !== appToken && url.searchParams.get('token') !== appToken) return json({ error: 'unauthorized' }, 401);
    const who = req.headers.get('x-forwarded-for') ?? 'local';

    if (url.pathname === '/v1/generate' && req.method === 'POST') {
      if (!llm || !critic) return json({ error: 'no LLM provider configured' }, 503);
      if (limited(`gen:${who}`)) return json({ error: 'rate limited' }, 429);
      let body: { specs?: GenSpec[]; avoid?: { reasoningPaths?: string[]; topics?: string[] } };
      try {
        body = await req.json();
      } catch {
        return json({ error: 'bad json' }, 400);
      }
      const specs = (body.specs ?? []).slice(0, maxSpecs);
      const avoid = { reasoningPaths: body.avoid?.reasoningPaths ?? [], topics: body.avoid?.topics ?? [] };
      const results = await Promise.allSettled(specs.map((s) => generateOne(llm, critic, s, avoid)));
      const questions = [];
      const reasons: string[] = [];
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value.question) {
          questions.push(r.value.question);
          avoid.reasoningPaths.push(r.value.question.reasoningPath);
        } else reasons.push(r.status === 'fulfilled' ? r.value.reason ?? 'rejected' : r.reason instanceof LlmRefusalError ? 'refusal' : String((r.reason as Error)?.message ?? r.reason));
      }
      return json({ questions, rejected: reasons.length, reasons });
    }

    if (url.pathname === '/v1/tts' && req.method === 'GET') {
      if (!tts) return json({ error: 'no TTS provider configured' }, 503);
      const text = (url.searchParams.get('text') ?? '').slice(0, 800);
      const voice = url.searchParams.get('voice') ?? 'M-us';
      const r = Number(url.searchParams.get('rate') ?? 1);
      if (!text) return json({ error: 'text required' }, 400);
      const key = `${voice}|${r}|${text}`;
      let audio = ttsCache.get(key);
      if (!audio) {
        if (limited(`tts:${who}`)) return json({ error: 'rate limited' }, 429);
        try {
          audio = await tts.synth(text, voice, r);
        } catch (e) {
          return json({ error: (e as Error).message }, 502);
        }
        ttsCache.set(key, audio);
      }
      return new Response(audio, { headers: { 'content-type': 'audio/mpeg', 'cache-control': 'public, max-age=31536000', 'access-control-allow-origin': '*' } });
    }
    return json({ error: 'not found' }, 404);
  };
}
