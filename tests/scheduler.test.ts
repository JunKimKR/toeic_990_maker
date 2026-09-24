import { allocate, computePriorities } from '../src/domain/scheduler';
import { buildBlueprint, buildExamBlueprint } from '../src/domain/planner';
import { seedSkillStates, snapshot, thetaFromScore } from '../src/domain/skillModel';
import { DAY_MS } from '../src/domain/rng';
import type { Attempt, SkillId, SkillState } from '../src/domain/types';

const NOW = Date.UTC(2026, 3, 1, 9);
const base = () => ({ states: seedSkillStates(undefined, NOW), recentAttempts: [] as Attempt[], budgetSeconds: 1800, now: NOW });

function share(alloc: ReturnType<typeof allocate>, skills: SkillId[]) {
  const total = [...alloc.focus, ...alloc.maintenance].reduce((s, a) => s + a.targetSeconds, 0) + alloc.challenge.seconds;
  return [...alloc.focus, ...alloc.maintenance].filter((a) => skills.includes(a.skill)).reduce((s, a) => s + a.targetSeconds, 0) / total;
}

const INTENT: SkillId[] = ['speaker_intent', 'implied_meaning', 'next_action_prediction', 'indirect_response'];
const GIST: SkillId[] = ['extended_gist', 'purpose_identification'];

describe('initial weights emerge from the profile (not hard-coded)', () => {
  const alloc = allocate(base());
  it('puts ~30% on intent and ~25-30% on extended gist/purpose', () => {
    expect(share(alloc, INTENT)).toBeGreaterThan(0.25);
    expect(share(alloc, INTENT)).toBeLessThan(0.42);
    expect(share(alloc, GIST)).toBeGreaterThan(0.18);
    expect(share(alloc, GIST)).toBeLessThan(0.34);
  });
  it('gives vocabulary ~10-18%, grammar ~6-12%, maintenance ~8-14%, challenge ~5%', () => {
    expect(share(alloc, ['vocabulary'])).toBeGreaterThan(0.09);
    expect(share(alloc, ['vocabulary'])).toBeLessThan(0.19);
    expect(share(alloc, ['grammar'])).toBeGreaterThan(0.05);
    expect(share(alloc, ['grammar'])).toBeLessThan(0.13);
    expect(alloc.shares.maintenance).toBeGreaterThanOrEqual(0.08);
    expect(alloc.shares.challenge).toBeCloseTo(0.05);
  });
  it('identifies intent, gist and vocabulary as the top bottlenecks', () => {
    expect(alloc.bottlenecks).toEqual(expect.arrayContaining(['speaker_intent', 'extended_gist']));
    expect(alloc.bottlenecks).toContain('vocabulary');
  });
  it('keeps strong skills at maintenance level only', () => {
    const inf = [...alloc.focus, ...alloc.maintenance].find((a) => a.skill === 'inference');
    expect(!inf || inf.targetSeconds < 150).toBe(true);
    expect(alloc.focus.find((a) => a.skill === 'short_detail')).toBeUndefined();
  });
});

describe('weights adapt to performance', () => {
  it('reduces intent share as speaker intent improves 65 -> 88', () => {
    const b = base();
    const before = share(allocate(b), ['speaker_intent']);
    const improved: Record<SkillId, SkillState> = { ...b.states, speaker_intent: { ...b.states.speaker_intent, theta: thetaFromScore(88) } };
    const after = share(allocate({ ...b, states: improved }), ['speaker_intent']);
    expect(after).toBeLessThan(before * 0.6);
  });
  it('increases vocabulary share when vocabulary plateaus despite practice', () => {
    const b = base();
    const before = share(allocate(b), ['vocabulary']);
    let v = { ...b.states.vocabulary, attemptCount: 60 };
    for (let i = 0; i < 6; i++) v = snapshot({ ...v, theta: thetaFromScore(78 + (i % 2) * 0.3) }, NOW - (6 - i) * 2 * DAY_MS);
    const after = share(allocate({ ...b, states: { ...b.states, vocabulary: v } }), ['vocabulary']);
    expect(after).toBeGreaterThan(before * 1.1);
    const pr = computePriorities({ ...b, states: { ...b.states, vocabulary: v } }).find((p) => p.skill === 'vocabulary')!;
    expect(pr.reasons.join(' ')).toContain('정체');
  });
  it('spreads time away from a skill hammered in the last 24h (fatigue / saturation)', () => {
    const b = base();
    const attempts = Array.from({ length: 40 }, (_, i) => ({ skill: 'speaker_intent', at: NOW - 3600_000 + i, correct: false, difficulty: 3 }) as unknown as Attempt);
    const p0 = computePriorities(b).find((p) => p.skill === 'speaker_intent')!.priority;
    const p1 = computePriorities({ ...b, recentAttempts: attempts }).find((p) => p.skill === 'speaker_intent')!.priority;
    expect(p1).toBeLessThan(p0 * 0.6);
  });
  it('boosts skills with confident-wrong answers (misconceptions)', () => {
    const b = base();
    const g = { ...b.states.grammar, confidentWrong: 3 };
    const p0 = computePriorities(b).find((p) => p.skill === 'grammar')!.priority;
    const p1 = computePriorities({ ...b, states: { ...b.states, grammar: g } }).find((p) => p.skill === 'grammar')!.priority;
    expect(p1).toBeGreaterThan(p0);
  });
});

describe('session blueprint', () => {
  it('fits 25-35 minutes and counts items per group', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const bp = buildBlueprint({ ...base(), mode: 'training', seed });
      expect(bp.estimatedSeconds / 60).toBeGreaterThanOrEqual(25);
      expect(bp.estimatedSeconds / 60).toBeLessThanOrEqual(35);
      expect((bp.groupCounts.intent ?? 0) + (bp.groupCounts.gist ?? 0)).toBeGreaterThan(bp.groupCounts.maintenance ?? 0);
      expect(bp.groupCounts.challenge).toBeGreaterThanOrEqual(2);
    }
  });
  it('respects a shorter daily budget', () => {
    const bp = buildBlueprint({ ...base(), budgetSeconds: 900, mode: 'training' });
    expect(bp.estimatedSeconds).toBeLessThanOrEqual(900 * 1.15);
    expect(bp.estimatedSeconds).toBeGreaterThanOrEqual(900 * 0.8);
  });
  it('interleaves formats (no 3 identical formats in a row) and ends with the challenge', () => {
    const bp = buildBlueprint({ ...base(), mode: 'training' });
    const parts = bp.slots.map((s) => s.part);
    let run = 1;
    let maxRun = 1;
    for (let i = 1; i < parts.length; i++) {
      run = parts[i] === parts[i - 1] ? run + 1 : 1;
      maxRun = Math.max(maxRun, run);
    }
    expect(maxRun).toBeLessThanOrEqual(3);
    expect(bp.slots[bp.slots.length - 1].isChallenge).toBe(true);
  });
  it('builds a TOEIC-ordered exam blueprint', () => {
    const bp = buildExamBlueprint({ ...base(), mode: 'exam' });
    const order = bp.slots.map((s) => s.part);
    expect(order[0]).toBe('P2');
    expect(order[order.length - 1]).toBe('P7');
    expect(bp.mode).toBe('exam');
  });
});
