/**
 * Web / test storage: localStorage-backed (or in-memory when unavailable).
 * Only used for browser previews and automated UI checks; phones use SQLite.
 */
import type { Database, LoadedData, WriteOp } from './types';

const KEY = 'toeic990.v1';

type Store = Omit<LoadedData, 'questions'> & { questions: Record<string, { q: LoadedData['questions'][number]['q']; status: 'shown' | 'pool' }> };

const empty = (): Store => ({ kv: {}, questions: {}, exposures: [], exactHashes: [], attempts: [], sessions: [], vocab: [], jobs: [], decisions: [] });

export function createDatabase(): Database {
  let mem: Store = empty();
  let timer: ReturnType<typeof setTimeout> | null = null;
  const ls = typeof localStorage !== 'undefined' ? localStorage : null;
  const flush = () => {
    if (!ls) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        ls.setItem(KEY, JSON.stringify(mem));
      } catch {
        // quota exceeded: drop old exposure detail but keep hashes
        mem.exposures = mem.exposures.slice(-400);
        try {
          ls.setItem(KEY, JSON.stringify(mem));
        } catch {
          /* give up silently: data stays in memory */
        }
      }
    }, 300);
  };
  return {
    async init() {
      try {
        const raw = ls?.getItem(KEY);
        if (raw) mem = { ...empty(), ...JSON.parse(raw) };
      } catch {
        mem = empty();
      }
    },
    async load(sinceMs: number) {
      return {
        kv: mem.kv,
        questions: Object.values(mem.questions).filter((x) => x.status === 'pool' || x.q.generationTimestamp >= sinceMs),
        exposures: mem.exposures.filter((e) => e.at >= sinceMs),
        exactHashes: mem.exactHashes,
        attempts: mem.attempts,
        sessions: mem.sessions,
        vocab: mem.vocab,
        jobs: mem.jobs.slice(-300),
        decisions: mem.decisions.slice(-400),
      };
    },
    async write(op: WriteOp) {
      switch (op.t) {
        case 'kv':
          mem.kv[op.key] = op.value;
          break;
        case 'question':
          mem.questions[op.q.id] = { q: op.q, status: op.status };
          break;
        case 'poolRemove':
          if (mem.questions[op.id]) mem.questions[op.id].status = 'shown';
          break;
        case 'exposure':
          mem.exposures.push(op.r);
          if (!mem.exactHashes.includes(op.r.exact)) mem.exactHashes.push(op.r.exact);
          break;
        case 'attempt':
          mem.attempts.push(op.a);
          break;
        case 'session': {
          const i = mem.sessions.findIndex((s) => s.id === op.s.id);
          if (i >= 0) mem.sessions[i] = op.s;
          else mem.sessions.push(op.s);
          break;
        }
        case 'vocab': {
          const i = mem.vocab.findIndex((v) => v.word === op.v.word);
          if (i >= 0) mem.vocab[i] = op.v;
          else mem.vocab.push(op.v);
          break;
        }
        case 'job':
          mem.jobs.push(op.j);
          if (mem.jobs.length > 400) mem.jobs.splice(0, mem.jobs.length - 400);
          break;
        case 'decision':
          mem.decisions.push(op.d);
          if (mem.decisions.length > 500) mem.decisions.splice(0, mem.decisions.length - 500);
          break;
      }
      flush();
    },
    async clear() {
      mem = empty();
      try {
        ls?.removeItem(KEY);
      } catch {
        /* ignore */
      }
    },
  };
}
