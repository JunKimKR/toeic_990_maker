/**
 * Offline simulator: a synthetic learner with hidden "true" abilities uses the
 * app for N days. Used by tests and scripts/simulate.ts to verify that
 *  - questions are novel over time (no re-serving within 14 days),
 *  - the skill model tracks the hidden ability,
 *  - the scheduler shifts time as skills improve or stagnate,
 *  - generation quality/distribution stays balanced.
 */
import { createRng, DAY_MS, sigmoid } from '../domain/rng';
import { DIFFICULTY_LOGIT, masteryFromTheta, thetaFromScore } from '../domain/skillModel';
import { ETS_CATEGORIES, SEED_MAP, SKILL_IDS } from '../domain/skills';
import type { DistractorType, Question, SkillId } from '../domain/types';
import { AppData, advance, createInitialData, currentQuestion, finishSession, itemsForMode, planToday, startSession, submitAnswer } from './engine';

export interface LearnerModel {
  trueTheta: Record<SkillId, number>;
  /** per-answer learning gain in logits on the practiced skill */
  learnRate: Partial<Record<SkillId, number>>;
  trapBias: Partial<Record<DistractorType, number>>;
}

export function defaultLearner(overrides: Partial<Record<SkillId, number>> = {}): LearnerModel {
  const trueTheta = {} as Record<SkillId, number>;
  for (const s of SKILL_IDS) {
    const src = SEED_MAP[s].from.map((c) => ETS_CATEGORIES[c]);
    trueTheta[s] = thetaFromScore(overrides[s] ?? src.reduce((a, b) => a + b, 0) / src.length);
  }
  return { trueTheta, learnRate: {}, trapBias: { keyword_overlap: 2, true_but_irrelevant: 2.5, literal_interpretation: 2 } };
}

export interface SimReport {
  days: number;
  sessions: number;
  questions: number;
  items: number;
  accuracy: number;
  failuresToGenerate: number;
  duplicateRejects: Record<string, number>;
  qualityRejects: number;
  relaxations: number;
  exactRepeats: number;
  reasoningRepeatsWithin14d: Record<string, number>;
  answerPositions: Record<string, number[]>;
  difficulty: Record<number, number>;
  parts: Record<string, number>;
  situations: Record<string, number>;
  skillsPracticed: Record<string, number>;
  masteryStart: Record<string, number>;
  masteryEnd: Record<string, number>;
  trueEnd: Record<string, number>;
  minutesPerSession: number[];
  groupShareFirst: Record<string, number>;
  groupShareLast: Record<string, number>;
  qualityIssues: Record<string, number>;
}

export function simulateDays(opts: { days: number; seed?: number; minutes?: number; learner?: LearnerModel; data?: AppData; startAt?: number }) {
  const rng = createRng(opts.seed ?? 1);
  const start = opts.startAt ?? Date.UTC(2026, 0, 5, 9);
  const data = opts.data ?? createInitialData(start, { ...ETS_CATEGORIES });
  data.profile.settings.dailyMinutes = opts.minutes ?? 30;
  const L = opts.learner ?? defaultLearner();
  const masteryStart: Record<string, number> = {};
  for (const s of SKILL_IDS) masteryStart[s] = +masteryFromTheta(data.skills[s].theta).toFixed(1);
  const minutesPerSession: number[] = [];
  const shares: Record<string, number>[] = [];
  let itemsTotal = 0;
  let correctTotal = 0;
  const shownAt: Record<string, number[]> = {};

  for (let day = 0; day < opts.days; day++) {
    const now0 = start + day * DAY_MS;
    const bp = planToday(data, now0, 'training', opts.seed ? opts.seed + day : day);
    minutesPerSession.push(+(bp.estimatedSeconds / 60).toFixed(1));
    const total = Object.values(bp.groupCounts).reduce((a, b) => a + (b ?? 0), 0);
    const share: Record<string, number> = {};
    for (const [g, c] of Object.entries(bp.groupCounts)) share[g] = +((c ?? 0) / total).toFixed(2);
    shares.push(share);
    const rt = startSession(data, bp, now0, {}, (opts.seed ?? 1) * 1000 + day);
    let t = now0;
    for (let guard = 0; guard < 200; guard++) {
      const cur = currentQuestion(data, rt, t);
      if (!cur) break;
      const q = cur.question;
      (shownAt[q.reasoningPath] ??= []).push(t);
      for (const item of itemsForMode(q, 'training')) {
        const ans = simulateAnswer(rng, L, q, item);
        t += ans.responseMs + 5000;
        submitAnswer(data, rt, { question: q, item, ...ans }, t);
        itemsTotal++;
        if (ans.selectedIndex === item.answerIndex) correctTotal++;
        // learning happens
        L.trueTheta[item.skill] += (L.learnRate[item.skill] ?? 0.004) * (ans.selectedIndex === item.answerIndex ? 1 : 1.5);
      }
      advance(data, rt, t);
    }
    finishSession(data, rt, t);
  }

  // novelty audit
  const exact = new Map<string, number>();
  for (const e of data.exposures) exact.set(e.exact, (exact.get(e.exact) ?? 0) + 1);
  const exactRepeats = [...exact.values()].filter((c) => c > 1).length;
  const reasoningRepeats: Record<string, number> = {};
  for (const [path, ts] of Object.entries(shownAt)) {
    const s = ts.sort((a, b) => a - b);
    for (let i = 1; i < s.length; i++) {
      if (s[i] - s[i - 1] < 14 * DAY_MS) {
        const part = path.split('.')[0];
        reasoningRepeats[part] = (reasoningRepeats[part] ?? 0) + 1;
      }
    }
  }
  const qs = Object.values(data.questions) as Question[];
  const positions: Record<string, number[]> = { '3': [0, 0, 0], '4': [0, 0, 0, 0] };
  const difficulty: Record<number, number> = {};
  const parts: Record<string, number> = {};
  const situations: Record<string, number> = {};
  for (const q of qs) {
    parts[q.part] = (parts[q.part] ?? 0) + 1;
    situations[q.situation] = (situations[q.situation] ?? 0) + 1;
    for (const it of q.items) {
      positions[String(it.choices.length)][it.answerIndex]++;
      difficulty[it.difficulty] = (difficulty[it.difficulty] ?? 0) + 1;
    }
  }
  const skillsPracticed: Record<string, number> = {};
  for (const a of data.attempts) skillsPracticed[a.skill] = (skillsPracticed[a.skill] ?? 0) + 1;
  const masteryEnd: Record<string, number> = {};
  const trueEnd: Record<string, number> = {};
  for (const s of SKILL_IDS) {
    masteryEnd[s] = +masteryFromTheta(data.skills[s].theta).toFixed(1);
    trueEnd[s] = +masteryFromTheta(L.trueTheta[s]).toFixed(1);
  }
  const report: SimReport = {
    days: opts.days,
    sessions: data.sessions.length,
    questions: qs.length,
    items: itemsTotal,
    accuracy: +(correctTotal / Math.max(1, itemsTotal)).toFixed(3),
    failuresToGenerate: data.genStats.failures,
    duplicateRejects: data.genStats.duplicateRejects,
    qualityRejects: data.genStats.qualityRejects,
    relaxations: data.genStats.relaxations,
    exactRepeats,
    reasoningRepeatsWithin14d: reasoningRepeats,
    answerPositions: positions,
    difficulty,
    parts,
    situations,
    skillsPracticed,
    masteryStart,
    masteryEnd,
    trueEnd,
    minutesPerSession,
    groupShareFirst: shares[0],
    groupShareLast: shares[shares.length - 1],
    qualityIssues: data.genStats.qualityIssues,
  };
  return { data, report, learner: L };
}

export function simulateAnswer(rng: ReturnType<typeof createRng>, L: LearnerModel, q: Question, item: Question['items'][number]) {
  const p = sigmoid(L.trueTheta[item.skill] - DIFFICULTY_LOGIT[item.difficulty]);
  const correct = rng.chance(p);
  let selectedIndex = item.answerIndex;
  if (!correct) {
    const wrong = item.choices.map((c, i) => ({ c, i })).filter((x) => x.i !== item.answerIndex);
    selectedIndex = rng.weighted(wrong, (x) => L.trapBias[x.c.distractorType!] ?? 1).i;
  }
  const lc = q.part === 'P2' || q.part === 'P3' || q.part === 'P4';
  const plays = lc ? (rng.chance(p) ? 1 : rng.pick([1, 2, 2, 3])) : 1;
  const responseMs = Math.round((8000 + rng.next() * 16000) * (correct ? 1 : 1.3));
  const confidence = (correct ? (rng.chance(0.7) ? 2 : 1) : rng.chance(0.3) ? 2 : rng.pick([0, 1])) as 0 | 1 | 2;
  return { selectedIndex, responseMs, plays, confidence, answerChanges: 0, firstChoiceWasCorrect: correct };
}
