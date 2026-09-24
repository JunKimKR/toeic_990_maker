/**
 * In-session adaptation. Personalisation must not wait until tomorrow:
 *  - 3 fast, correct answers in a row on a skill  -> +0.5 difficulty
 *  - 3 misses in a row at difficulty >= 4           -> -0.75 difficulty and a
 *    remedial focus on the most frequent mistake cause of those misses
 *  - otherwise a slow EWMA drift, so single mistakes never make difficulty jump
 */
import { clamp } from './rng';
import type { BlueprintSlot, Difficulty, MistakeCause, SkillId } from './types';

export interface SkillTrack {
  offset: number;
  ewma: number;
  streakFastCorrect: number;
  streakWrong: number;
  recentCauses: MistakeCause[];
  n: number;
}

export interface AdaptState {
  tracks: Partial<Record<SkillId, SkillTrack>>;
  remedial: Partial<Record<SkillId, MistakeCause>>;
  log: string[];
}

export const createAdaptState = (): AdaptState => ({ tracks: {}, remedial: {}, log: [] });

const newTrack = (): SkillTrack => ({ offset: 0, ewma: 0.7, streakFastCorrect: 0, streakWrong: 0, recentCauses: [], n: 0 });

export interface AdaptEvent {
  skill: SkillId;
  correct: boolean;
  credit: number;
  fast: boolean;
  difficulty: Difficulty;
  causes: MistakeCause[];
}

export function adaptOnResult(state: AdaptState, e: AdaptEvent): AdaptState {
  const t: SkillTrack = { ...(state.tracks[e.skill] ?? newTrack()) };
  const log = state.log.slice();
  const remedial = { ...state.remedial };
  t.n += 1;
  t.ewma = 0.65 * t.ewma + 0.35 * e.credit;
  if (e.correct && e.fast && e.credit >= 0.85) t.streakFastCorrect += 1;
  else t.streakFastCorrect = 0;
  if (!e.correct) {
    t.streakWrong += 1;
    t.recentCauses = [...t.recentCauses, ...e.causes].slice(-9);
  } else t.streakWrong = 0;

  if (t.streakFastCorrect >= 3) {
    t.offset = clamp(t.offset + 0.5, -1.5, 1.5);
    t.streakFastCorrect = 0;
    log.push(`${e.skill}: 3연속 빠른 정답 → 난이도 +0.5`);
    delete remedial[e.skill];
  } else if (t.streakWrong >= 3 && e.difficulty >= 4) {
    t.offset = clamp(t.offset - 0.75, -1.5, 1.5);
    t.streakWrong = 0;
    const cause = mostFrequent(t.recentCauses);
    if (cause) remedial[e.skill] = cause;
    log.push(`${e.skill}: 고난도 3연속 오답 → 난이도 -0.75${cause ? `, ${cause} 집중` : ''}`);
  } else if (t.n >= 3 && Math.abs(t.ewma - 0.7) > 0.2) {
    // gentle drift (smoothing): at most ±0.1 per answer
    t.offset = clamp(t.offset + clamp(0.25 * (t.ewma - 0.7), -0.1, 0.1), -1.5, 1.5);
  }
  return { tracks: { ...state.tracks, [e.skill]: t }, remedial, log };
}

export function effectiveDifficulty(slot: BlueprintSlot, state: AdaptState): Difficulty {
  if (slot.isChallenge) return 5;
  const off = state.tracks[slot.skill]?.offset ?? 0;
  return clamp(Math.round(slot.difficulty + off), 2, 5) as Difficulty;
}

export function adaptSlot(slot: BlueprintSlot, state: AdaptState): BlueprintSlot {
  const d = effectiveDifficulty(slot, state);
  const cause = state.remedial[slot.skill];
  if (d === slot.difficulty && !cause) return slot;
  return { ...slot, difficulty: d, focusCause: cause ?? slot.focusCause };
}

function mostFrequent<T>(xs: T[]): T | undefined {
  const m = new Map<T, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  let best: T | undefined;
  let bc = 0;
  for (const [k, c] of m) if (c > bc) (best = k), (bc = c);
  return best;
}
