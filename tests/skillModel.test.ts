import { applyInactivity, confidenceOf, createSkillState, masteryFromTheta, performanceCredit, seedSkillStates, snapshot, targetDifficulty, toView, trendOf, updateSkill } from '../src/domain/skillModel';
import { DAY_MS } from '../src/domain/rng';

const obs = (over: Partial<Parameters<typeof updateSkill>[1]> = {}) => ({
  difficulty: 3 as const,
  credit: 1,
  correct: true,
  responseMs: 10000,
  plays: 1,
  isListening: true,
  confidence: 2 as const,
  isFirstExposure: true,
  misconception: false,
  at: Date.now(),
  ...over,
});

describe('seeding from the ETS score report', () => {
  const s = seedSkillStates();
  it('maps measured categories directly', () => {
    expect(masteryFromTheta(s.extended_gist.theta)).toBeCloseTo(68, 0);
    expect(masteryFromTheta(s.speaker_intent.theta)).toBeCloseTo(65, 0);
    expect(masteryFromTheta(s.vocabulary.theta)).toBeCloseTo(79, 0);
    expect(masteryFromTheta(s.inference.theta)).toBeCloseTo(96, 0);
  });
  it('caps 100 below certainty and derives fine-grained skills with higher uncertainty', () => {
    expect(masteryFromTheta(s.short_detail.theta)).toBeLessThan(98);
    expect(s.next_action_prediction.sigma).toBeGreaterThan(s.extended_gist.sigma);
    expect(masteryFromTheta(s.next_action_prediction.theta)).toBeCloseTo(66.5, 0);
  });
  it('keeps the gist/detail gap that defines this learner', () => {
    expect(masteryFromTheta(s.extended_detail.theta) - masteryFromTheta(s.extended_gist.theta)).toBeGreaterThan(20);
  });
});

describe('skill update', () => {
  it('raises mastery after a correct answer and lowers it after a wrong one', () => {
    const st = createSkillState('speaker_intent', 65, 0.6);
    const up = updateSkill(st, obs());
    const down = updateSkill(st, obs({ correct: false, credit: 0 }));
    expect(up.delta).toBeGreaterThan(0);
    expect(down.delta).toBeLessThan(0);
  });
  it('fast first-listen correct raises mastery more than a replayed, unsure correct answer', () => {
    const st = createSkillState('speaker_intent', 65, 0.6);
    const fluent = performanceCredit({ correct: true, isListening: true, plays: 1, responseMs: 5000, typicalMs: 14000, confidence: 2, answerChanges: 0 });
    const shaky = performanceCredit({ correct: true, isListening: true, plays: 3, responseMs: 40000, typicalMs: 14000, confidence: 0, answerChanges: 1 });
    expect(fluent.credit).toBeGreaterThan(shaky.credit);
    const a = updateSkill(st, obs({ credit: fluent.credit }));
    const b = updateSkill(st, obs({ credit: shaky.credit, plays: 3 }));
    expect(a.delta).toBeGreaterThan(b.delta * 1.3);
    expect(shaky.fragile).toBe(true);
  });
  it('flags confident wrong answers as misconceptions and corrects harder', () => {
    const c = performanceCredit({ correct: false, isListening: false, plays: 1, responseMs: 9000, typicalMs: 20000, confidence: 2, answerChanges: 0 });
    expect(c.misconception).toBe(true);
    const st = createSkillState('grammar', 85, 0.6);
    const normal = updateSkill(st, obs({ correct: false, credit: 0 }));
    const confident = updateSkill(st, obs({ correct: false, credit: 0, misconception: true }));
    expect(confident.delta).toBeLessThan(normal.delta);
    expect(confident.state.confidentWrong).toBeGreaterThan(0);
  });
  it('harder items give more credit when solved, less penalty when missed', () => {
    const st = createSkillState('vocabulary', 79, 0.6);
    expect(updateSkill(st, obs({ difficulty: 5 })).delta).toBeGreaterThan(updateSkill(st, obs({ difficulty: 2 })).delta);
    expect(updateSkill(st, obs({ difficulty: 5, correct: false, credit: 0 })).delta).toBeGreaterThan(updateSkill(st, obs({ difficulty: 2, correct: false, credit: 0 })).delta);
  });
  it('shrinks uncertainty with evidence and inflates it with inactivity', () => {
    let st = createSkillState('grammar', 85, 0.8);
    for (let i = 0; i < 20; i++) st = updateSkill(st, obs({ correct: i % 3 !== 0, credit: i % 3 !== 0 ? 1 : 0 })).state;
    expect(st.sigma).toBeLessThan(0.8);
    expect(confidenceOf(st)).toBeGreaterThan(0.3);
    const later = applyInactivity(st, st.lastPracticedAt! + 60 * DAY_MS);
    expect(later.sigma).toBeGreaterThan(st.sigma);
  });
  it('tracks stats used by the dashboard', () => {
    let st = createSkillState('extended_gist', 68, 0.6);
    st = updateSkill(st, obs({ plays: 1 })).state;
    st = updateSkill(st, obs({ plays: 2 })).state;
    st = updateSkill(st, obs({ correct: false, credit: 0 })).state;
    const v = toView(st);
    expect(v.attemptCount).toBe(3);
    expect(v.recentAccuracy).toBeCloseTo(2 / 3);
    expect(v.firstListenAccuracy).toBeCloseTo(1 / 3);
    expect(v.medianResponseTime).toBe(10000);
  });
  it('computes trend from per-session snapshots', () => {
    let st = createSkillState('speaker_intent', 65, 0.6);
    const t0 = Date.now();
    for (let i = 0; i < 5; i++) {
      st = { ...st, theta: st.theta + 0.2 };
      st = snapshot(st, t0 + i * DAY_MS * 1.1);
    }
    expect(trendOf(st)).toBeGreaterThan(2);
  });
  it('targets desirable difficulty (3-4) for this learner', () => {
    const s = seedSkillStates();
    expect(targetDifficulty(s.speaker_intent)).toBe(3);
    expect(targetDifficulty(s.vocabulary)).toBeGreaterThanOrEqual(3);
    expect(targetDifficulty(s.inference)).toBeGreaterThanOrEqual(4);
  });
});
