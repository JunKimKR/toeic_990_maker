import type { Rng } from '../domain/rng';
import type { BlueprintSlot, Choice, DistractorType, Question, Situation, TrainingMode } from '../domain/types';

/**
 * What the generator knows about recent history so it can *sample away* from
 * recently used templates/tricks/situations (constraint-aware generation).
 * The duplicate detector is still run afterwards as an independent gate.
 */
export interface NoveltyContext {
  templateCounts: Map<string, number>;
  reasoningCounts: Map<string, number>;
  situationRecent: Situation[]; // newest last
  topicRecent: string[];
  answerPatterns: Set<string>;
  /** answer-position counts in the recent window, per choice count (3 or 4) */
  positionCounts: { 3: number[]; 4: number[] };
  /** lexical keys (e.g. target words, word-family roots) used recently */
  lexicalKeys: Map<string, number>;
}

export const emptyNovelty = (): NoveltyContext => ({
  templateCounts: new Map(),
  reasoningCounts: new Map(),
  situationRecent: [],
  topicRecent: [],
  answerPatterns: new Set(),
  positionCounts: { 3: [0, 0, 0], 4: [0, 0, 0, 0] },
  lexicalKeys: new Map(),
});

export interface GenContext {
  rng: Rng;
  slot: BlueprintSlot;
  novelty: NoveltyContext;
  mode: TrainingMode;
  now: number;
}

export type Generator = (ctx: GenContext) => Question | null;

export interface RawChoice {
  text: string;
  correct?: boolean;
  type?: DistractorType;
  rationale?: string;
}

/** Freshness weight: strongly prefer options not used recently. */
export function freshWeight(count: number | undefined): number {
  const c = count ?? 0;
  return 1 / Math.pow(1 + c * 2, 2);
}

export function pickFresh<T>(rng: Rng, options: readonly T[], key: (t: T) => string, counts: Map<string, number>): T {
  return rng.weighted(options, (o) => freshWeight(counts.get(key(o))));
}

export function situationWeight(sit: Situation, novelty: NoveltyContext): number {
  const idx = novelty.situationRecent.lastIndexOf(sit);
  if (idx < 0) return 1;
  const age = novelty.situationRecent.length - idx; // 1 = most recent
  return Math.min(1, 0.05 + age / 12);
}

/**
 * Arrange choices with a balanced answer position: prefer the position that has
 * been the answer least often recently (keeps A/B/C/D distribution flat).
 */
export function arrangeChoices(rng: Rng, raw: RawChoice[], novelty: NoveltyContext): { choices: Choice[]; answerIndex: number } {
  const correct = raw.find((r) => r.correct);
  if (!correct) throw new Error('no correct choice');
  const wrong = rng.shuffle(raw.filter((r) => !r.correct));
  const n = wrong.length + 1;
  const counts = n === 3 ? novelty.positionCounts[3] : n === 4 ? novelty.positionCounts[4] : new Array(n).fill(0);
  const minC = Math.min(...counts);
  const candidates = counts.map((c, i) => ({ c, i })).filter((x) => x.c <= minC + 1);
  const pos = rng.weighted(candidates, (x) => (x.c === minC ? 3 : 1)).i;
  const ordered: RawChoice[] = [...wrong];
  ordered.splice(pos, 0, correct);
  if (n === 3 || n === 4) counts[pos] += 1; // update local view so a session stays balanced
  return {
    choices: ordered.map((r) => ({ text: r.text, distractorType: r.correct ? undefined : r.type, rationale: r.rationale })),
    answerIndex: pos,
  };
}
