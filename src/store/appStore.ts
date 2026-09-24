/**
 * App state (zustand). The engine mutates AppData in place; `version` is bumped
 * after every mutation so subscribed screens re-render.
 */
import { create, StoreApi, UseBoundStore } from 'zustand';
import { uid } from '../domain/rng';
import { SKILLS } from '../domain/skills';
import type { BlueprintSlot, Question, TrainingBlueprint, TrainingMode, TrainingSession, UserSettings } from '../domain/types';
import { weakVocabQueue } from '../domain/vocabulary';
import { VOCAB_BY_WORD } from '../generation/content/vocabBank';
import { Repository } from '../data/repository';
import { poolDeficits, requestBatch } from '../services/aiClient';
import {
  advance,
  AnswerFeedback,
  AnswerInput,
  AppData,
  currentQuestion,
  finishSession,
  PersistSink,
  planToday,
  SessionRuntime,
  startSession,
  submitAnswer,
} from '../services/engine';

const repo = new Repository();

interface AiStatus {
  state: 'off' | 'idle' | 'fetching' | 'ok' | 'error';
  message?: string;
  lastAdded?: number;
}

export interface AppState {
  ready: boolean;
  bootError: string | null;
  data: AppData | null;
  version: number;
  plan: TrainingBlueprint | null;
  runtime: SessionRuntime | null;
  ai: AiStatus;
  init(): Promise<void>;
  refreshPlan(): void;
  start(mode?: TrainingMode, kind?: 'daily' | 'vocab'): boolean;
  current(): { question: Question; slotIndex: number } | null;
  answer(input: AnswerInput): AnswerFeedback | null;
  review(input: AnswerInput): AnswerFeedback | null;
  next(): void;
  finish(): TrainingSession | null;
  abandon(): void;
  updateSettings(p: Partial<UserSettings>): void;
  resetAll(): Promise<void>;
  refillPool(): Promise<void>;
  storageErrors(): string[];
}

let sinkRef: PersistSink | null = null;
const sink = (): PersistSink => (sinkRef ??= repo.sink((): AppData | null => useApp.getState().data));

function vocabBlueprint(data: AppData, now: number): TrainingBlueprint {
  const weak = weakVocabQueue(Object.values(data.vocab), now, 16).filter((v) => VOCAB_BY_WORD[v.word]);
  const slots: BlueprintSlot[] = [];
  const words = weak.length ? weak.map((w) => w.word) : [];
  const n = Math.max(8, Math.min(16, words.length * 2));
  for (let i = 0; i < n; i++) {
    const w = words[i % Math.max(1, words.length)];
    slots.push({ id: uid('slot'), part: 'VOC', skill: i % 4 === 3 ? 'paraphrase' : 'vocabulary', difficulty: 4, group: 'vocabulary', estimatedSeconds: 32, vocabTargets: w ? [w] : undefined, reason: '취약 어휘 새 문맥 반복' });
  }
  return {
    id: uid('bp'),
    createdAt: now,
    mode: 'training',
    budgetSeconds: n * 32,
    estimatedSeconds: n * 32,
    slots,
    allocations: [],
    groupCounts: { vocabulary: n },
    bottlenecks: ['vocabulary'],
    decisions: [`Vocabulary drill: ${words.length} weak words`],
  };
}

export const useApp: UseBoundStore<StoreApi<AppState>> = create<AppState>((set, get) => ({
  ready: false,
  bootError: null,
  data: null,
  version: 0,
  plan: null,
  runtime: null,
  ai: { state: 'off' },

  async init() {
    if (get().ready) return;
    try {
      await repo.init();
      const data = await repo.load();
      set({ data, ready: true, ai: { state: data.profile.settings.apiBaseUrl ? 'idle' : 'off' } });
      get().refreshPlan();
      // warm the AI pool in the background (never blocks the UI)
      setTimeout(() => get().refillPool(), 1500);
    } catch (e) {
      // storage failure: keep working in memory so the learner can still train
      const { createInitialData } = await import('../services/engine');
      const { ETS_CATEGORIES } = await import('../domain/skills');
      set({ data: createInitialData(Date.now(), { ...ETS_CATEGORIES }), ready: true, bootError: (e as Error).message });
      get().refreshPlan();
    }
  },

  refreshPlan() {
    const data = get().data;
    if (!data) return;
    set({ plan: planToday(data, Date.now()), version: get().version + 1 });
  },

  start(mode, kind = 'daily') {
    const data = get().data;
    if (!data) return false;
    const now = Date.now();
    const m = mode ?? data.profile.settings.mode;
    const bp = kind === 'vocab' ? vocabBlueprint(data, now) : m === get().plan?.mode && get().plan ? get().plan! : planToday(data, now, m);
    const rt = startSession(data, bp, now, sink());
    set({ runtime: rt, version: get().version + 1 });
    return true;
  },

  current() {
    const { data, runtime } = get();
    if (!data || !runtime) return null;
    return currentQuestion(data, runtime, Date.now(), sink());
  },

  answer(input) {
    const { data, runtime } = get();
    if (!data || !runtime) return null;
    const fb = submitAnswer(data, runtime, input, Date.now(), sink());
    set({ version: get().version + 1 });
    return fb;
  },

  review(input) {
    const { data } = get();
    if (!data) return null;
    const fb = submitAnswer(data, null, input, Date.now(), sink());
    set({ version: get().version + 1 });
    return fb;
  },

  next() {
    const { data, runtime } = get();
    if (!data || !runtime) return;
    advance(data, runtime, Date.now(), sink());
    set({ version: get().version + 1 });
  },

  finish() {
    const { data, runtime } = get();
    if (!data || !runtime) return null;
    if (runtime.attempts.length === 0) {
      set({ runtime: null });
      return null;
    }
    const s = finishSession(data, runtime, Date.now(), sink());
    set({ runtime: null, version: get().version + 1 });
    get().refreshPlan();
    setTimeout(() => get().refillPool(), 500);
    return s;
  },

  abandon() {
    const { runtime } = get();
    if (runtime && runtime.attempts.length > 0) {
      get().finish();
      return;
    }
    set({ runtime: null });
  },

  updateSettings(p) {
    const data = get().data;
    if (!data) return;
    data.profile.settings = { ...data.profile.settings, ...p };
    repo.write({ t: 'kv', key: 'profile', value: data.profile });
    set({ version: get().version + 1, ai: { state: data.profile.settings.apiBaseUrl ? get().ai.state === 'off' ? 'idle' : get().ai.state : 'off' } });
    if ('dailyMinutes' in p || 'mode' in p || 'difficultyBias' in p) get().refreshPlan();
  },

  async resetAll() {
    await repo.reset();
    const data = await repo.load();
    set({ data, runtime: null, version: get().version + 1 });
    get().refreshPlan();
  },

  async refillPool() {
    const { data, plan } = get();
    if (!data || !plan) return;
    const base = data.profile.settings.apiBaseUrl;
    if (!base) {
      set({ ai: { state: 'off' } });
      return;
    }
    if (get().ai.state === 'fetching') return;
    const specs = poolDeficits(data, plan.slots);
    if (!specs.length) return;
    set({ ai: { ...get().ai, state: 'fetching' } });
    const recent = data.exposures.slice(-200);
    const res = await requestBatch(base, specs, { reasoningPaths: [...new Set(recent.map((r) => r.reasoningPath))].slice(-80), topics: [...new Set(recent.map((r) => r.topic))].slice(-40) });
    if (res.error) {
      set({ ai: { state: 'error', message: res.error } });
      return;
    }
    data.pool.push(...res.accepted);
    for (const q of res.accepted) repo.write({ t: 'question', q, status: 'pool' });
    data.decisions.push({ at: Date.now(), kind: 'generation', message: `AI batch: +${res.accepted.length} accepted, ${res.rejected} rejected (${specs.map((s) => `${s.part}/${SKILLS[s.skill].label}`).join(', ')})` });
    set({ ai: { state: 'ok', lastAdded: res.accepted.length }, version: get().version + 1 });
  },

  storageErrors() {
    return repo.errors.slice();
  },
}));

/** Subscribe to data changes. */
export function useData(): AppData | null {
  useApp((s) => s.version);
  return useApp((s) => s.data);
}
