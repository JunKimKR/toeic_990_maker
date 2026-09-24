/**
 * Repository: loads AppData from storage and provides a PersistSink that
 * writes every change through a sequential queue (write-behind, local-first).
 * Storage errors never surface to the learner; they are logged and the
 * in-memory state keeps working.
 */
import { DAY_MS } from '../domain/rng';
import { masteryFromTheta, seedSkillStates } from '../domain/skillModel';
import { ETS_CATEGORIES, SKILL_IDS } from '../domain/skills';
import type { SkillId, SkillState, UserProfile } from '../domain/types';
import { emptyStats, PipelineStats } from '../generation/pipeline';
import { AppData, createInitialData, DEFAULT_SETTINGS, PersistSink } from '../services/engine';
import { createDatabase } from './db';
import type { Database, WriteOp } from './types';

export const LOAD_WINDOW_DAYS = 45;

export class Repository {
  private db: Database;
  private queue: Promise<void> = Promise.resolve();
  private skillTimer: ReturnType<typeof setTimeout> | null = null;
  errors: string[] = [];

  constructor(db: Database = createDatabase()) {
    this.db = db;
  }

  async init(): Promise<void> {
    await this.db.init();
  }

  async load(now = Date.now()): Promise<AppData> {
    const L = await this.db.load(now - LOAD_WINDOW_DAYS * DAY_MS);
    const profile = L.kv.profile as UserProfile | undefined;
    if (!profile) {
      const fresh = createInitialData(now, { ...ETS_CATEGORIES });
      this.write({ t: 'kv', key: 'profile', value: fresh.profile });
      this.write({ t: 'kv', key: 'skills', value: fresh.skills });
      return fresh;
    }
    const stored = (L.kv.skills as Record<SkillId, SkillState> | undefined) ?? seedSkillStates(ETS_CATEGORIES, now);
    // forward-compatible: add skills introduced in newer versions
    const seeded = seedSkillStates(ETS_CATEGORIES, now);
    const skills = {} as Record<SkillId, SkillState>;
    for (const s of SKILL_IDS) skills[s] = stored[s] ?? seeded[s];
    const questions: AppData['questions'] = {};
    const pool: AppData['pool'] = [];
    for (const { q, status } of L.questions) {
      if (status === 'pool') pool.push(q);
      else questions[q.id] = q;
    }
    return {
      profile: { ...profile, settings: { ...DEFAULT_SETTINGS, ...profile.settings } },
      skills,
      questions,
      pool,
      exposures: L.exposures,
      exactHashes: L.exactHashes,
      attempts: L.attempts,
      sessions: L.sessions,
      vocab: Object.fromEntries(L.vocab.map((v) => [v.word, v])),
      familyOffsets: (L.kv.familyOffsets as Record<string, number>) ?? {},
      decisions: L.decisions,
      genStats: { ...emptyStats(), ...((L.kv.genStats as PipelineStats) ?? {}) },
      jobs: L.jobs,
    };
  }

  write(op: WriteOp) {
    this.queue = this.queue
      .then(() => this.db.write(op))
      .catch((e: unknown) => {
        this.errors.push(`${op.t}: ${(e as Error)?.message ?? String(e)}`);
        if (this.errors.length > 50) this.errors.shift();
      });
  }

  flush(): Promise<void> {
    return this.queue;
  }

  async reset(): Promise<void> {
    await this.flush();
    await this.db.clear();
  }

  sink(data: () => AppData | null): PersistSink {
    return {
      question: (q) => this.write({ t: 'question', q, status: 'shown' }),
      poolRemove: (id) => this.write({ t: 'poolRemove', id }),
      exposure: (r) => this.write({ t: 'exposure', r }),
      attempt: (a) => this.write({ t: 'attempt', a }),
      skills: (s) => {
        // skill states change on every answer: debounce the (larger) write
        if (this.skillTimer) clearTimeout(this.skillTimer);
        this.skillTimer = setTimeout(() => this.write({ t: 'kv', key: 'skills', value: s }), 400);
      },
      vocab: (v) => this.write({ t: 'vocab', v }),
      session: (s) => this.write({ t: 'session', s }),
      job: (j) => this.write({ t: 'job', j }),
      decision: (d) => this.write({ t: 'decision', d }),
      profile: (p) => this.write({ t: 'kv', key: 'profile', value: p }),
      family: () => {
        const d = data();
        if (d) this.write({ t: 'kv', key: 'familyOffsets', value: d.familyOffsets });
      },
      stats: (s) => this.write({ t: 'kv', key: 'genStats', value: s }),
    };
  }

  savePool(data: AppData) {
    for (const q of data.pool) this.write({ t: 'question', q, status: 'pool' });
  }
}

export function masterySnapshot(data: AppData): Record<SkillId, number> {
  const out = {} as Record<SkillId, number>;
  for (const s of SKILL_IDS) out[s] = masteryFromTheta(data.skills[s].theta);
  return out;
}
