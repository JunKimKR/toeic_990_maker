/**
 * Question generation pipeline:
 *
 *   SKILL SELECTOR (scheduler) -> TRAINING BLUEPRINT (planner) -> slot
 *     -> [pool of validated unseen questions (AI / pre-generated)]
 *     -> QUESTION GENERATOR (procedural, constraint-aware)
 *     -> TOEIC STYLE CRITIC + ANSWER VALIDATOR + DISTRACTOR VALIDATOR (critic.ts)
 *     -> DUPLICATE DETECTOR (duplicate.ts)
 *     -> DIFFICULTY CALIBRATOR (difficulty.ts)
 *     -> FINAL QUESTION
 *
 * Generators never judge their own output; every candidate goes through the
 * same independent gates, whether it came from the procedural engine, the AI
 * backend, or the seed set.
 */
import { partCanTrain, singleFormatFor } from '../domain/planner';
import { Rng, uid } from '../domain/rng';
import type { BlueprintSlot, GenerationJob, Question, QualityReview, TrainingMode } from '../domain/types';
import { reviewQuestion } from './critic';
import { calibrateQuestion } from './difficulty';
import { DuplicateDetector, ExposureRecord, toExposureRecord } from './duplicate';
import { emptyNovelty, GenContext, Generator, NoveltyContext } from './genTypes';
import { generateP2 } from './generators/p2';
import { generateP3 } from './generators/p3';
import { generateP4 } from './generators/p4';
import { generateP5Grammar } from './generators/p5';
import { generateP6, generateP7 } from './generators/reading';
import { generateVocab } from './generators/voc';

export function generatorFor(slot: BlueprintSlot): Generator {
  switch (slot.part) {
    case 'P2':
      return generateP2;
    case 'P3':
      return generateP3;
    case 'P4':
      return generateP4;
    case 'P5':
      return slot.skill === 'vocabulary' ? generateVocab : generateP5Grammar;
    case 'VOC':
      return generateVocab;
    case 'P6':
      return generateP6;
    case 'P7':
      return generateP7;
  }
}

export function buildNovelty(records: readonly ExposureRecord[]): NoveltyContext {
  const n = emptyNovelty();
  const recent = records.slice(-300);
  for (const r of recent) {
    n.templateCounts.set(r.templateId, (n.templateCounts.get(r.templateId) ?? 0) + 1);
    n.reasoningCounts.set(r.reasoningPath, (n.reasoningCounts.get(r.reasoningPath) ?? 0) + 1);
    for (const k of r.lexKeys) n.lexicalKeys.set(k, (n.lexicalKeys.get(k) ?? 0) + 1);
    n.situationRecent.push(r.situation);
    n.topicRecent.push(r.topic);
    n.answerPatterns.add(r.answerPattern);
    for (const pos of r.answerPositions) {
      const bucket = r.part === 'P2' ? n.positionCounts[3] : n.positionCounts[4];
      if (pos >= 0 && pos < bucket.length) bucket[pos] += 1;
    }
  }
  n.situationRecent = n.situationRecent.slice(-30);
  n.topicRecent = n.topicRecent.slice(-30);
  return n;
}

export function noteExposure(n: NoveltyContext, r: ExposureRecord) {
  n.templateCounts.set(r.templateId, (n.templateCounts.get(r.templateId) ?? 0) + 1);
  n.reasoningCounts.set(r.reasoningPath, (n.reasoningCounts.get(r.reasoningPath) ?? 0) + 1);
  for (const k of r.lexKeys) n.lexicalKeys.set(k, (n.lexicalKeys.get(k) ?? 0) + 1);
  n.situationRecent.push(r.situation);
  n.answerPatterns.add(r.answerPattern);
}

export interface PipelineStats {
  generated: number;
  accepted: number;
  qualityRejects: number;
  duplicateRejects: Record<string, number>;
  relaxations: number;
  poolHits: number;
  formatFallbacks: number;
  failures: number;
  qualityIssues: Record<string, number>;
}

export const emptyStats = (): PipelineStats => ({
  generated: 0,
  accepted: 0,
  qualityRejects: 0,
  duplicateRejects: {},
  relaxations: 0,
  poolHits: 0,
  formatFallbacks: 0,
  failures: 0,
  qualityIssues: {},
});

export interface MaterializeInput {
  slot: BlueprintSlot;
  mode: TrainingMode;
  now: number;
  rng: Rng;
  detector: DuplicateDetector;
  novelty: NoveltyContext;
  /** validated, never-shown questions (AI batch / pre-generated / seed) */
  pool?: Question[];
  stats?: PipelineStats;
  maxAttempts?: number;
}

export interface MaterializeResult {
  question: Question | null;
  job: GenerationJob;
  review?: QualityReview;
  decisions: string[];
}

/** Run a candidate through every gate. */
export function gate(q: Question, detector: DuplicateDetector, now: number, strictness: 0 | 1 | 2, stats?: PipelineStats): { ok: boolean; question: Question; review: QualityReview; reason?: string; novelty: number } {
  const review = reviewQuestion(q);
  if (!review.passed) {
    if (stats) {
      stats.qualityRejects++;
      for (const i of review.issues) {
        const k = i.replace(/:.*/, '');
        stats.qualityIssues[k] = (stats.qualityIssues[k] ?? 0) + 1;
      }
    }
    return { ok: false, question: q, review, reason: `quality ${review.score}: ${review.issues.slice(0, 2).join('; ')}`, novelty: 0 };
  }
  const dup = detector.check(q, now, strictness);
  if (!dup.ok) {
    if (stats) stats.duplicateRejects[`L${dup.level}`] = (stats.duplicateRejects[`L${dup.level}`] ?? 0) + 1;
    return { ok: false, question: q, review, reason: `dup L${dup.level}: ${dup.reason}`, novelty: dup.novelty };
  }
  const { question, notes } = calibrateQuestion(q);
  return { ok: true, question: { ...question, qualityScore: review.score, qualityNotes: [...review.issues, ...notes] }, review, novelty: dup.novelty };
}

function slotMatches(q: Question, slot: BlueprintSlot): boolean {
  if (q.part !== slot.part) return false;
  const skills = new Set(q.items.map((i) => i.skill));
  if (!skills.has(slot.skill) && q.skill !== slot.skill) return false;
  return Math.abs(q.difficulty - slot.difficulty) <= 1;
}

/** Ordered fallbacks when a slot's own format/content space is exhausted. */
export function fallbackSlots(slot: BlueprintSlot, rng: Rng): BlueprintSlot[] {
  const out: BlueprintSlot[] = [];
  const noTargets = { ...slot, vocabTargets: undefined };
  switch (slot.part) {
    case 'P4':
      out.push({ ...slot, part: 'P3' });
      break;
    case 'P3':
      out.push({ ...slot, part: 'P4', itemSkills: slot.itemSkills?.map((s) => (partCanTrain('P4', s) ? s : 'extended_detail')) });
      out.push({ ...slot, part: 'P2', skill: 'indirect_response', itemSkills: undefined });
      break;
    case 'P2': {
      const siblings = (['indirect_response', 'short_gist', 'implied_meaning', 'short_detail', 'negative_question'] as const).filter((s) => s !== slot.skill);
      for (const s of siblings.slice(0, 2)) out.push({ ...slot, skill: s });
      out.push({ ...slot, part: 'P3', skill: slot.skill === 'short_detail' ? 'extended_detail' : 'speaker_intent', itemSkills: undefined });
      break;
    }
    case 'P5':
      if (slot.skill === 'vocabulary') {
        if (slot.vocabTargets?.length) out.push({ ...slot, part: 'VOC' }, noTargets);
        out.push({ ...noTargets, part: 'VOC' });
      }
      break;
    case 'VOC':
      if (slot.vocabTargets?.length) out.push(noTargets, { ...slot, part: 'P5', skill: 'vocabulary' });
      out.push({ ...noTargets, part: 'P5', skill: 'vocabulary' });
      break;
    case 'P6':
      out.push({ ...slot, part: 'P7' });
      break;
    case 'P7':
      out.push({ ...slot, part: 'P6' });
      break;
  }
  const single = singleFormatFor(slot.skill, rng);
  if (single.part !== slot.part && !out.some((o) => o.part === single.part)) out.push({ ...noTargets, part: single.part, skill: single.s, itemSkills: undefined });
  return out.filter((o) => partCanTrain(o.part, o.skill) || o.part === 'P3' || o.part === 'P4');
}

export function materialize(input: MaterializeInput): MaterializeResult {
  const { slot, now, rng, detector, novelty, stats } = input;
  const decisions: string[] = [];
  const rejectReasons: string[] = [];
  const job: GenerationJob = { id: uid('job'), at: now, slotSkill: slot.skill, part: slot.part, source: 'procedural', attempts: 0, accepted: false, rejectReasons };

  const accept = (q: Question, review: QualityReview): MaterializeResult => {
    const rec = toExposureRecord(q, now);
    detector.add(rec);
    noteExposure(novelty, rec);
    job.accepted = true;
    job.source = q.sourceType;
    if (stats) stats.accepted++;
    return { question: q, job, review, decisions };
  };

  // 1) pool first (AI-generated / pre-generated, never shown)
  if (input.pool?.length) {
    const cands = input.pool.filter((q) => slotMatches(q, slot));
    let best: { q: Question; review: QualityReview; novelty: number } | null = null;
    for (const c of cands.slice(0, 30)) {
      const g = gate(c, detector, now, 0);
      if (g.ok && (!best || g.novelty > best.novelty)) best = { q: g.question, review: g.review, novelty: g.novelty };
    }
    if (best) {
      if (stats) stats.poolHits++;
      const idx = input.pool.indexOf(input.pool.find((p) => p.id === best!.q.id)!);
      if (idx >= 0) input.pool.splice(idx, 1);
      return accept(best.q, best.review);
    }
  }

  // 2) procedural generation with escalating relaxation of soft novelty rules
  const tryGenerate = (s: BlueprintSlot, attempts: number): MaterializeResult | null => {
    const gen = generatorFor(s);
    const ctx: GenContext = { rng, slot: s, novelty, mode: input.mode, now };
    let best: { q: Question; review: QualityReview; novelty: number } | null = null;
    for (let a = 0; a < attempts; a++) {
      job.attempts++;
      const strictness: 0 | 1 | 2 = a < attempts * 0.6 ? 0 : a < attempts * 0.85 ? 1 : 2;
      let q: Question | null = null;
      try {
        q = gen(ctx);
      } catch (e) {
        rejectReasons.push(`generator error: ${(e as Error).message}`);
      }
      if (stats) stats.generated++;
      if (!q) continue;
      const g = gate(q, detector, now, strictness, stats);
      if (!g.ok) {
        rejectReasons.push(g.reason ?? 'rejected');
        continue;
      }
      if (strictness > 0) {
        if (stats) stats.relaxations++;
        decisions.push(`novelty rules relaxed (level ${strictness}) for ${s.part}/${s.skill}`);
      }
      if (!best || g.novelty > best.novelty) best = { q: g.question, review: g.review, novelty: g.novelty };
      // accept early when clearly novel, otherwise keep sampling a little
      if (g.novelty > 0.75 || a >= 3) break;
    }
    return best ? accept(best.q, best.review) : null;
  };

  const attempts = input.maxAttempts ?? 14;
  const r = tryGenerate(slot, attempts);
  if (r) return r;

  // 3) format fallback: same skill, different format (then a sibling skill)
  const alternatives = fallbackSlots(slot, rng);
  for (const alt of alternatives) {
    if (stats) stats.formatFallbacks++;
    decisions.push(`format fallback ${slot.part}/${slot.skill}→${alt.part}/${alt.skill}${alt.vocabTargets ? '' : slot.vocabTargets ? ' (other word)' : ''}`);
    const r2 = tryGenerate(alt, 10);
    if (r2) return r2;
  }
  if (stats) stats.failures++;
  return { question: null, job, decisions };
}
