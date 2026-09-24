/**
 * Client for the optional generation backend (server/). The mobile app never
 * holds an API key: it asks the backend for a *batch* of questions described
 * by blueprint specs, re-validates every returned question with the local
 * critic, and keeps them in a local pool. Sessions draw from the pool first,
 * so the learner never waits on the network, and everything still works
 * offline via the procedural engine.
 */
import { uid } from '../domain/rng';
import type { BlueprintSlot, Question } from '../domain/types';
import { reviewQuestion } from '../generation/critic';
import { computeSemanticFingerprint } from '../generation/fingerprint';
import type { AppData } from './engine';

export interface GenSpec {
  part: BlueprintSlot['part'];
  skill: BlueprintSlot['skill'];
  difficulty: BlueprintSlot['difficulty'];
  itemSkills?: BlueprintSlot['itemSkills'];
  vocabTargets?: string[];
}

export interface AiBatchResult {
  accepted: Question[];
  rejected: number;
  error?: string;
}

/** Base URL may carry an optional access token: https://host?token=abc */
export function splitBase(baseUrl: string): { base: string; token: string } {
  const [b, q] = baseUrl.split('?');
  const token = new URLSearchParams(q ?? '').get('token') ?? '';
  return { base: b.replace(/\/$/, ''), token };
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

export async function checkBackend(baseUrl: string): Promise<{ ok: boolean; provider?: string; tts?: string; error?: string }> {
  if (!baseUrl) return { ok: false, error: 'no url' };
  try {
    const { base, token } = splitBase(baseUrl);
    const r = await fetchWithTimeout(`${base}/v1/health`, { headers: token ? { 'x-app-token': token } : {} }, 6000);
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
    const j = await r.json();
    return { ok: true, provider: j.provider, tts: j.tts };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Normalise + locally re-validate a question coming from the backend. */
export function acceptRemote(q: Question, now: number): Question | null {
  try {
    const fixed: Question = {
      ...q,
      id: uid('qai'),
      sourceType: 'ai',
      generationTimestamp: now,
      items: q.items.map((it) => ({ ...it, id: uid('itai') })),
      vocabularyTargets: q.vocabularyTargets ?? [],
      distractorTypes: q.distractorTypes ?? [],
    };
    fixed.semanticFingerprint = computeSemanticFingerprint(fixed);
    const review = reviewQuestion(fixed);
    if (!review.passed) return null;
    return { ...fixed, qualityScore: review.score, qualityNotes: review.issues };
  } catch {
    return null;
  }
}

export async function requestBatch(baseUrl: string, specs: GenSpec[], avoid: { reasoningPaths: string[]; topics: string[] }, now = Date.now()): Promise<AiBatchResult> {
  try {
    const { base, token } = splitBase(baseUrl);
    const r = await fetchWithTimeout(
      `${base}/v1/generate`,
      { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { 'x-app-token': token } : {}) }, body: JSON.stringify({ specs, avoid }) },
      90_000,
    );
    if (!r.ok) return { accepted: [], rejected: 0, error: `HTTP ${r.status}` };
    const j = (await r.json()) as { questions: Question[]; rejected?: number };
    const accepted: Question[] = [];
    let rejected = j.rejected ?? 0;
    for (const q of j.questions ?? []) {
      const a = acceptRemote(q, now);
      if (a) accepted.push(a);
      else rejected++;
    }
    return { accepted, rejected };
  } catch (e) {
    return { accepted: [], rejected: 0, error: (e as Error).message };
  }
}

/** Decide what the pool is missing, weighted toward today's bottlenecks. */
export function poolDeficits(data: AppData, plan: BlueprintSlot[], maxSpecs = 6): GenSpec[] {
  const have = new Map<string, number>();
  for (const q of data.pool) have.set(`${q.part}:${q.skill}`, (have.get(`${q.part}:${q.skill}`) ?? 0) + 1);
  const specs: GenSpec[] = [];
  const counted = new Map<string, number>();
  for (const s of plan) {
    if (s.part === 'P5' && s.skill === 'grammar') continue; // procedural grammar is plentiful
    const k = `${s.part}:${s.skill}`;
    const need = (counted.get(k) ?? 0) + 1;
    counted.set(k, need);
    if ((have.get(k) ?? 0) >= need + 1) continue;
    specs.push({ part: s.part, skill: s.skill, difficulty: s.difficulty, itemSkills: s.itemSkills, vocabTargets: s.vocabTargets });
    if (specs.length >= maxSpecs) break;
  }
  return specs;
}
