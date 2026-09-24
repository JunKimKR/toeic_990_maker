/**
 * Skill model: an explainable Elo / Glicko-lite ability estimate per skill.
 *
 *  - Each skill has ability `theta` (logits) and uncertainty `sigma`.
 *  - mastery = 100 * sigmoid(theta) = expected accuracy on a standard
 *    (difficulty 3 ≈ average real-TOEIC) item of that skill.
 *  - Each item has difficulty b (logits) from its 1..5 label plus a learned
 *    family offset (item-family calibration).
 *  - After an attempt, P(correct) = sigmoid(theta - b), and
 *      theta += K * f * (y - P)          y = 1 if correct else 0
 *    where f is a fluency factor from the *performance credit*: a fast,
 *    first-listen, confident correct answer raises mastery more than a
 *    correct answer after 3 replays or with "확신 없음" (f 0.6 .. 1.1);
 *    confident-wrong answers (possible misconceptions) use f = 1.2.
 *  - K shrinks as sigma shrinks (more evidence => smaller steps), sigma grows
 *    again with inactivity (skills can decay / estimates get stale).
 */
import { clamp, DAY_MS, logit, median, sigmoid } from './rng';
import { ETS_CATEGORIES, SEED_MAP, SKILL_IDS, SKILLS } from './skills';
import type { ConfidenceLevel, Difficulty, SkillId, SkillState, SkillView } from './types';

export const DIFFICULTY_LOGIT: Record<Difficulty, number> = { 1: -1.6, 2: -0.8, 3: 0, 4: 0.8, 5: 1.6 };

export const SIGMA_MIN = 0.3; // never fully certain: people keep learning / forgetting
export const SIGMA_MAX = 1.0;
const RECENT_N = 20;
const RT_N = 30;
const EWMA_ALPHA = 0.15;
const MAX_MASTERY = 0.985;

export function masteryFromTheta(theta: number): number {
  return 100 * sigmoid(theta);
}

export function thetaFromScore(score: number): number {
  return logit(clamp(score / 100, 0.03, 0.97));
}

export function createSkillState(skill: SkillId, seedScore: number, sigma: number): SkillState {
  return {
    skill,
    theta: thetaFromScore(seedScore),
    sigma,
    seedScore,
    attemptCount: 0,
    correctCount: 0,
    recent: [],
    ewmaAccuracy: seedScore / 100,
    responseTimes: [],
    daWeightedCorrect: 0,
    daWeightTotal: 0,
    firstAttemptCount: 0,
    firstAttemptCorrect: 0,
    firstListenCount: 0,
    firstListenCorrect: 0,
    confidentWrong: 0,
    lastPracticedAt: null,
    history: [],
  };
}

/** Build initial skill states from ETS score-report categories. */
export function seedSkillStates(
  ets: Record<string, number> = ETS_CATEGORIES,
  now = Date.now(),
): Record<SkillId, SkillState> {
  const out = {} as Record<SkillId, SkillState>;
  for (const id of SKILL_IDS) {
    const m = SEED_MAP[id];
    const vals = m.from.map((c) => ets[c]).filter((v): v is number => typeof v === 'number');
    const score = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 80;
    const st = createSkillState(id, score, m.sigma);
    st.history.push({ t: now, mastery: masteryFromTheta(st.theta) });
    out[id] = st;
  }
  return out;
}

export interface CreditInput {
  correct: boolean;
  isListening: boolean;
  plays: number;
  responseMs: number;
  typicalMs: number;
  confidence: ConfidenceLevel | null;
  answerChanges: number;
  timedOut?: boolean;
}

export interface CreditResult {
  credit: number;
  notes: string[];
  misconception: boolean;
  fragile: boolean;
}

/**
 * Performance credit. 1.0 = fast, confident, first-listen correct.
 * Wrong answers give 0; confident-wrong is flagged as a misconception.
 */
export function performanceCredit(i: CreditInput): CreditResult {
  const notes: string[] = [];
  if (!i.correct || i.timedOut) {
    const misconception = !i.timedOut && i.confidence === 2;
    if (misconception) notes.push('확신했지만 오답 → 잘못된 규칙/해석 가능성');
    return { credit: 0, notes, misconception, fragile: false };
  }
  let c = 1;
  if (i.isListening && i.plays > 1) {
    const pen = Math.min(0.4, 0.15 * (i.plays - 1));
    c -= pen;
    notes.push(`${i.plays}회 재생`);
  }
  const ratio = i.responseMs / Math.max(1, i.typicalMs);
  if (ratio > 2) {
    c -= 0.15;
    notes.push('풀이 시간이 매우 김');
  } else if (ratio > 1.4) {
    c -= 0.07;
    notes.push('풀이 시간이 다소 김');
  } else if (ratio < 0.6) {
    c = Math.min(1, c + 0.03);
  }
  if (i.confidence === 0) {
    c -= 0.2;
    notes.push('정답이지만 확신 없음');
  } else if (i.confidence === 1) {
    c -= 0.07;
  }
  if (i.answerChanges > 0) c -= Math.min(0.1, 0.05 * i.answerChanges);
  const credit = clamp(c, 0.35, 1);
  return { credit, notes, misconception: false, fragile: credit < 0.7 };
}

export interface Observation {
  difficulty: Difficulty;
  familyOffset?: number;
  credit: number;
  correct: boolean;
  responseMs: number;
  plays: number;
  isListening: boolean;
  confidence: ConfidenceLevel | null;
  isFirstExposure: boolean;
  misconception: boolean;
  at: number;
  /** 1 for primary skill, ~0.35 for secondary skills */
  weight?: number;
}

export function itemLogit(d: Difficulty, familyOffset = 0): number {
  return DIFFICULTY_LOGIT[d] + clamp(familyOffset, -0.8, 0.8);
}

export function expectedP(state: SkillState, d: Difficulty, familyOffset = 0): number {
  return sigmoid(state.theta - itemLogit(d, familyOffset));
}

/** Inflate uncertainty for inactivity. Returns a new state. */
export function applyInactivity(state: SkillState, now: number): SkillState {
  if (!state.lastPracticedAt) return state;
  const days = (now - state.lastPracticedAt) / DAY_MS;
  if (days < 1) return state;
  const s2 = state.sigma * state.sigma + 0.004 * days;
  return { ...state, sigma: clamp(Math.sqrt(s2), SIGMA_MIN, SIGMA_MAX) };
}

export function stepSize(sigma: number, p: number): number {
  // Glicko-flavoured gain: larger when uncertain, bounded for stability.
  const s2 = sigma * sigma;
  return clamp((0.55 * s2) / (1 + s2 * p * (1 - p)), 0.05, 0.4);
}

export function updateSkill(state: SkillState, o: Observation): { state: SkillState; expected: number; delta: number } {
  const w = o.weight ?? 1;
  const b = itemLogit(o.difficulty, o.familyOffset);
  const p = sigmoid(state.theta - b);
  // Ability is estimated from the binary outcome (unbiased: mastery stays an
  // honest "expected accuracy"). Fluency signals change only the step size:
  // fast first-listen correct answers move mastery up more, replayed/slow/unsure
  // correct answers move it up less, confident errors pull it down harder.
  const fluency = o.correct ? clamp(1 + 0.6 * (o.credit - 0.85), 0.6, 1.1) : o.misconception ? 1.2 : 1;
  const k = stepSize(state.sigma, p) * w * fluency;
  let theta = state.theta + k * ((o.correct ? 1 : 0) - p);
  theta = Math.min(theta, logit(MAX_MASTERY));
  // Bayesian information update of the uncertainty
  const s2 = 1 / (1 / (state.sigma * state.sigma) + w * p * (1 - p));
  const sigma = clamp(Math.sqrt(s2), SIGMA_MIN, SIGMA_MAX);

  const next: SkillState = { ...state, theta, sigma };
  if (w >= 1) {
    next.attemptCount = state.attemptCount + 1;
    next.correctCount = state.correctCount + (o.correct ? 1 : 0);
    next.recent = [...state.recent, o.correct ? 1 : 0].slice(-RECENT_N);
    next.ewmaAccuracy = (o.correct ? 1 : 0) * EWMA_ALPHA + state.ewmaAccuracy * (1 - EWMA_ALPHA);
    next.responseTimes = [...state.responseTimes, o.responseMs].slice(-RT_N);
    const dw = 1 + 0.25 * (o.difficulty - 3);
    next.daWeightedCorrect = state.daWeightedCorrect + (o.correct ? dw : 0);
    next.daWeightTotal = state.daWeightTotal + dw;
    if (o.isFirstExposure) {
      next.firstAttemptCount = state.firstAttemptCount + 1;
      next.firstAttemptCorrect = state.firstAttemptCorrect + (o.correct ? 1 : 0);
    }
    if (o.isListening) {
      next.firstListenCount = state.firstListenCount + 1;
      next.firstListenCorrect = state.firstListenCorrect + (o.correct && o.plays <= 1 ? 1 : 0);
    }
    // misconception counter decays slowly and increments on confident-wrong
    next.confidentWrong = Math.max(0, state.confidentWrong * 0.9 + (o.misconception ? 1 : 0));
    next.lastPracticedAt = o.at;
  }
  return { state: next, expected: p, delta: masteryFromTheta(theta) - masteryFromTheta(state.theta) };
}

/** Linear-regression slope of mastery over the last n history points (points per session). */
export function trendOf(state: SkillState, n = 6): number {
  const h = state.history.slice(-n);
  if (h.length < 2) return 0;
  const xs = h.map((_, i) => i);
  const ys = h.map((p) => p.mastery);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

export function snapshot(state: SkillState, t: number): SkillState {
  const m = masteryFromTheta(state.theta);
  const last = state.history[state.history.length - 1];
  if (last && Math.abs(last.mastery - m) < 0.01 && t - last.t < DAY_MS) return state;
  return { ...state, history: [...state.history, { t, mastery: m }].slice(-60) };
}

export function confidenceOf(state: SkillState): number {
  // 0 (sigma = max) .. 1 (sigma = min)
  return clamp((SIGMA_MAX - state.sigma) / (SIGMA_MAX - SIGMA_MIN), 0, 1);
}

export function toView(state: SkillState): SkillView {
  const meta = SKILLS[state.skill];
  const recentAcc = state.recent.length ? state.recent.reduce((a, b) => a + b, 0) / state.recent.length : null;
  return {
    skill: state.skill,
    label: meta.label,
    section: meta.section,
    masteryScore: Math.round(masteryFromTheta(state.theta) * 10) / 10,
    confidence: confidenceOf(state),
    attemptCount: state.attemptCount,
    recentAccuracy: recentAcc,
    weightedAccuracy: state.attemptCount > 0 ? state.ewmaAccuracy : null,
    medianResponseTime: median(state.responseTimes),
    difficultyAdjustedAccuracy: state.daWeightTotal > 0 ? state.daWeightedCorrect / state.daWeightTotal : null,
    lastPracticedAt: state.lastPracticedAt,
    trend: trendOf(state),
    firstAttemptAccuracy: state.firstAttemptCount ? state.firstAttemptCorrect / state.firstAttemptCount : null,
    firstListenAccuracy: state.firstListenCount ? state.firstListenCorrect / state.firstListenCount : null,
  };
}

/** Pick the difficulty that gives ~target success probability (desirable difficulty). */
export function targetDifficulty(state: SkillState, targetP = 0.68, bias = 0): Difficulty {
  const b = state.theta - logit(targetP) + bias * 0.6;
  let best: Difficulty = 3;
  let bestDist = Infinity;
  for (const d of [1, 2, 3, 4, 5] as Difficulty[]) {
    const dist = Math.abs(DIFFICULTY_LOGIT[d] - b);
    if (dist < bestDist) {
      bestDist = dist;
      best = d;
    }
  }
  // High-level learner: never train below 2; default band is 3-4.
  return Math.max(2, best) as Difficulty;
}

/** Item-family calibration: learn per-template difficulty offsets from outcomes. */
export function updateFamilyOffset(offset: number, expected: number, correct: boolean): number {
  // If users do better than expected, the family is easier than labelled -> lower offset.
  return clamp(offset + 0.08 * (expected - (correct ? 1 : 0)), -0.8, 0.8);
}
