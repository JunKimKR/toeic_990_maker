/**
 * Adaptive Scheduler
 *
 * Answers, every day: "what is currently the biggest bottleneck between this
 * learner and 990, and how should today's ~30 minutes be spent?"
 *
 * priority(skill) =
 *     importance × gap                      (exam points still recoverable)
 *   + 0.06 × sigma × importance             (exploration: uncertain estimates)
 *   + staleness bonus                       (time since last practice)
 *   + misconception bonus                   (confident-but-wrong answers)
 *   × saturation factor                     (already practiced a lot in last 24h)
 *   × plateau factor                        (stuck despite practice -> push harder)
 *
 * Weak skills (mastery < STRONG) share the focus budget ∝ priority^1.5
 * (sharpened so the real bottlenecks dominate, capped at 32% per skill).
 * Strong skills get a small rotating maintenance budget; a small share goes to
 * difficulty-5 challenge items. None of the shares are hard-coded per skill:
 * they all fall out of the current skill states.
 */
import { applyInactivity, masteryFromTheta, targetDifficulty, trendOf } from './skillModel';
import { SKILL_IDS, SKILLS } from './skills';
import { clamp, DAY_MS } from './rng';
import type { Attempt, Difficulty, SkillAllocation, SkillId, SkillState } from './types';

export const STRONG_THRESHOLD = 90;
export const TARGET_MASTERY = 97.5;

export interface SchedulerInput {
  states: Record<SkillId, SkillState>;
  recentAttempts: Attempt[]; // ideally last 14 days
  budgetSeconds: number;
  difficultyBias?: number;
  now: number;
}

export interface SkillPriority {
  skill: SkillId;
  mastery: number;
  priority: number;
  strong: boolean;
  reasons: string[];
  components: {
    value: number;
    exploration: number;
    staleness: number;
    misconception: number;
    saturation: number;
    plateau: number;
  };
}

export function computePriorities(input: SchedulerInput): SkillPriority[] {
  const { now } = input;
  const last24 = new Map<SkillId, number>();
  const last3d = new Map<SkillId, number>();
  for (const a of input.recentAttempts) {
    if (now - a.at < DAY_MS) last24.set(a.skill, (last24.get(a.skill) ?? 0) + 1);
    if (now - a.at < 3 * DAY_MS) last3d.set(a.skill, (last3d.get(a.skill) ?? 0) + 1);
  }
  return SKILL_IDS.map((skill) => {
    const st = applyInactivity(input.states[skill], now);
    const meta = SKILLS[skill];
    const mastery = masteryFromTheta(st.theta);
    const reasons: string[] = [];
    const gap = Math.max(0, TARGET_MASTERY - mastery) / 100;
    const value = meta.importance * gap;
    const exploration = 0.06 * st.sigma * meta.importance;
    const daysSince = st.lastPracticedAt ? (now - st.lastPracticedAt) / DAY_MS : 3;
    const staleness = Math.min(0.03, 0.006 * daysSince) * meta.importance;
    const misconception = Math.min(0.06, 0.02 * st.confidentWrong) * meta.importance;
    if (misconception > 0.01) reasons.push('확신 오답(잘못된 규칙) 교정 필요');

    const n24 = last24.get(skill) ?? 0;
    const saturation = 1 / (1 + n24 / 25);
    if (n24 >= 15) reasons.push(`최근 24시간 ${n24}문제 → 비중 일부 분산`);

    let plateau = 1;
    const tr = trendOf(st, 5);
    if (st.attemptCount >= 25 && st.history.length >= 4 && gap > 0.08 && Math.abs(tr) < 0.4) {
      plateau = 1.3;
      reasons.push('연습량 대비 정체 → 비중 확대');
    } else if (tr > 2 && st.history.length >= 3) {
      plateau = 0.9;
      reasons.push('빠르게 향상 중');
    } else if (tr < -1 && st.history.length >= 3) {
      plateau = 1.15;
      reasons.push('하락 추세');
    }

    const strong = mastery >= STRONG_THRESHOLD;
    if (!strong && gap > 0.2) reasons.unshift(`990까지 격차 큼 (${mastery.toFixed(0)})`);
    if (st.sigma > 0.65) reasons.push('추정 불확실 → 탐색');

    const priority = (value + exploration + staleness + misconception) * saturation * plateau;
    return {
      skill,
      mastery,
      priority,
      strong,
      reasons,
      components: { value, exploration, staleness, misconception, saturation, plateau },
    };
  }).sort((a, b) => b.priority - a.priority);
}

export interface Allocation {
  focus: SkillAllocation[];
  maintenance: SkillAllocation[];
  challenge: { seconds: number; skills: SkillId[] };
  shares: { focus: number; maintenance: number; challenge: number };
  bottlenecks: SkillId[];
  decisions: string[];
}

export function highDifficultyAccuracy(attempts: Attempt[]): number | null {
  const hd = attempts.filter((a) => a.difficulty >= 5);
  if (hd.length < 5) return null;
  return hd.filter((a) => a.correct).length / hd.length;
}

export function allocate(input: SchedulerInput, priorities = computePriorities(input)): Allocation {
  const B = input.budgetSeconds;
  const decisions: string[] = [];
  const bias = input.difficultyBias ?? 0;

  const hda = highDifficultyAccuracy(input.recentAttempts);
  let challengeShare = 0.05;
  if (hda !== null && hda > 0.7) {
    challengeShare = 0.08;
    decisions.push(`고난도 정답률 ${(hda * 100).toFixed(0)}% → 챌린지 비중 확대`);
  } else if (hda !== null && hda < 0.35) {
    challengeShare = 0.03;
    decisions.push(`고난도 정답률 ${(hda * 100).toFixed(0)}% → 챌린지 비중 축소`);
  }

  const strong = priorities.filter((p) => p.strong);
  const weak = priorities.filter((p) => !p.strong);
  const staleStrong = strong.filter((p) => {
    const st = input.states[p.skill];
    return !st.lastPracticedAt || input.now - st.lastPracticedAt > 5 * DAY_MS;
  }).length;
  let maintShare = clamp(0.07 + 0.01 * staleStrong, 0.08, 0.13);
  if (weak.length === 0) maintShare = 0.9 - challengeShare;
  const focusShare = 1 - challengeShare - maintShare;

  // --- focus: sharpened proportional allocation with cap ---
  const CAP = 0.32;
  const raw = weak.map((p) => ({ p, w: Math.pow(Math.max(1e-6, p.priority), 1.5) }));
  let shares = normalize(raw.map((r) => r.w));
  for (let iter = 0; iter < 5; iter++) {
    let excess = 0;
    let freeTotal = 0;
    shares = shares.map((s) => {
      if (s > CAP) {
        excess += s - CAP;
        return CAP;
      }
      freeTotal += s;
      return s;
    });
    if (excess < 1e-9 || freeTotal === 0) break;
    shares = shares.map((s) => (s < CAP ? s + (excess * s) / freeTotal : s));
  }
  const focus: SkillAllocation[] = raw
    .map((r, i) => ({
      skill: r.p.skill,
      priority: r.p.priority,
      targetSeconds: shares[i] * focusShare * B,
      reasons: r.p.reasons,
      targetDifficulty: targetDifficulty(input.states[r.p.skill], 0.68, bias) as Difficulty,
    }))
    // drop crumbs (< 45s) — they'd be a single rushed item; re-spread later
    .filter((a) => a.targetSeconds >= 45);
  const focusSum = focus.reduce((s, a) => s + a.targetSeconds, 0);
  if (focusSum > 0) {
    const scale = (focusShare * B) / focusSum;
    focus.forEach((a) => (a.targetSeconds *= scale));
  }

  // --- maintenance: rotate the stalest / most uncertain strong skills ---
  const maintCandidates = strong
    .map((p) => {
      const st = input.states[p.skill];
      const days = st.lastPracticedAt ? (input.now - st.lastPracticedAt) / DAY_MS : 7;
      return { p, score: (days + 1) * (0.5 + st.sigma) * SKILLS[p.skill].importance };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, weak.length === 0 ? 8 : 3);
  const mNorm = normalize(maintCandidates.map((m) => m.score));
  const maintenance: SkillAllocation[] = maintCandidates.map((m, i) => ({
    skill: m.p.skill,
    priority: m.p.priority,
    targetSeconds: mNorm[i] * maintShare * B,
    reasons: ['강점 유지 (최소 비중)'],
    targetDifficulty: Math.max(4, targetDifficulty(input.states[m.p.skill], 0.68, bias)) as Difficulty,
  }));

  // --- challenge: difficulty-5 items on the skills with the best payoff ---
  const challengeSkills = priorities
    .filter((p) => SKILLS[p.skill].formats.length > 0)
    .slice(0, 4)
    .map((p) => p.skill);

  const bottlenecks = weak
    .slice()
    .sort((a, b) => b.components.value - a.components.value || b.priority - a.priority)
    .slice(0, 3)
    .map((p) => p.skill);

  for (const a of focus.slice(0, 4)) {
    decisions.push(`${SKILLS[a.skill].label}: ${(a.targetSeconds / 60).toFixed(1)}분 (priority ${a.priority.toFixed(3)}; ${a.reasons.join(', ') || '격차 기반'})`);
  }

  return {
    focus,
    maintenance,
    challenge: { seconds: challengeShare * B, skills: challengeSkills },
    shares: { focus: focusShare, maintenance: maintShare, challenge: challengeShare },
    bottlenecks,
    decisions,
  };
}

function normalize(xs: number[]): number[] {
  const s = xs.reduce((a, b) => a + b, 0);
  return s > 0 ? xs.map((x) => x / s) : xs.map(() => (xs.length ? 1 / xs.length : 0));
}
