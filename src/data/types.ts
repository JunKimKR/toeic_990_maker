import type { AdaptiveDecisionLog, Attempt, GenerationJob, Question, TrainingSession, VocabularyItem } from '../domain/types';
import type { ExposureRecord } from '../generation/duplicate';

export type WriteOp =
  | { t: 'kv'; key: string; value: unknown }
  | { t: 'question'; q: Question; status: 'shown' | 'pool' }
  | { t: 'poolRemove'; id: string }
  | { t: 'exposure'; r: ExposureRecord }
  | { t: 'attempt'; a: Attempt }
  | { t: 'session'; s: TrainingSession }
  | { t: 'vocab'; v: VocabularyItem }
  | { t: 'job'; j: GenerationJob }
  | { t: 'decision'; d: AdaptiveDecisionLog };

export interface LoadedData {
  kv: Record<string, unknown>;
  questions: { q: Question; status: 'shown' | 'pool' }[];
  exposures: ExposureRecord[];
  exactHashes: string[];
  attempts: Attempt[];
  sessions: TrainingSession[];
  vocab: VocabularyItem[];
  jobs: GenerationJob[];
  decisions: AdaptiveDecisionLog[];
}

/** Storage backend. Native = SQLite, web = localStorage (dev only). */
export interface Database {
  init(): Promise<void>;
  load(sinceMs: number): Promise<LoadedData>;
  write(op: WriteOp): Promise<void>;
  clear(): Promise<void>;
}
