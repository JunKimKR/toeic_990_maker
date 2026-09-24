import { DAY_MS } from '../src/domain/rng';
import { masteryFromTheta } from '../src/domain/skillModel';
import { ETS_CATEGORIES } from '../src/domain/skills';
import { advance, createInitialData, currentQuestion, finishSession, itemsForMode, planToday, reviewQueue, startSession, submitAnswer } from '../src/services/engine';
import { simulateDays } from '../src/services/simulation';

const NOW = Date.UTC(2026, 3, 1, 9);

describe('a full adaptive session', () => {
  const data = createInitialData(NOW, { ...ETS_CATEGORIES });
  const bp = planToday(data, NOW);
  const rt = startSession(data, bp, NOW, {}, 99);
  let t = NOW;
  let answered = 0;
  const intentBefore = masteryFromTheta(data.skills.speaker_intent.theta);
  for (let g = 0; g < 200; g++) {
    const cur = currentQuestion(data, rt, t);
    if (!cur) break;
    for (const item of itemsForMode(cur.question, 'training')) {
      t += 15000;
      // learner answers intent items wrong with the literal trap, everything else right
      const trap = item.choices.findIndex((c) => c.distractorType === 'literal_interpretation');
      const wrong = (item.skill === 'speaker_intent' || item.skill === 'implied_meaning') && trap >= 0;
      submitAnswer(data, rt, { question: cur.question, item, selectedIndex: wrong ? trap : item.answerIndex, responseMs: 9000, plays: 1, confidence: wrong ? 2 : 2, answerChanges: 0, firstChoiceWasCorrect: !wrong }, t);
      answered++;
    }
    advance(data, rt, t);
  }
  const s = finishSession(data, rt, t);

  it('serves the whole blueprint without failures', () => {
    expect(answered).toBeGreaterThan(30);
    expect(rt.skipped.length).toBeLessThanOrEqual(1);
  });
  it('moves skill estimates in the right direction', () => {
    expect(masteryFromTheta(data.skills.speaker_intent.theta)).toBeLessThan(intentBefore);
    expect(masteryFromTheta(data.skills.grammar.theta)).toBeGreaterThan(85);
  });
  it('records mistake patterns (literal interpretation) and a pattern sentence', () => {
    expect(s.summary!.topCauses[0].cause).toBe('literal_interpretation');
    expect(s.summary!.topTraps[0].type).toBe('literal_interpretation');
    expect(s.summary!.pattern.length).toBeGreaterThan(10);
  });
  it('tracks first-listen accuracy and response time', () => {
    expect(s.summary!.firstListenAccuracy).not.toBeNull();
    expect(s.summary!.avgResponseSec).toBeCloseTo(9, 0);
  });
  it('the next session reacts: intent gets at least as much time, and literal-interpretation is targeted', () => {
    const next = planToday(data, t + DAY_MS);
    const intentSecs = (b: typeof bp) => b.allocations.filter((a) => a.skill === 'speaker_intent' || a.skill === 'implied_meaning').reduce((x, a) => x + a.targetSeconds, 0);
    expect(intentSecs(next)).toBeGreaterThanOrEqual(intentSecs(bp) * 0.95);
    expect(next.slots.some((sl) => sl.focusCause === 'literal_interpretation')).toBe(true);
  });
  it('never re-serves a shown question in the next normal session', () => {
    const shown = new Set(rt.session.questionIds);
    const rt2 = startSession(data, planToday(data, t + DAY_MS), t + DAY_MS, {}, 100);
    let t2 = t + DAY_MS;
    for (let g = 0; g < 200; g++) {
      const cur = currentQuestion(data, rt2, t2);
      if (!cur) break;
      expect(shown.has(cur.question.id)).toBe(false);
      for (const item of itemsForMode(cur.question, 'training')) submitAnswer(data, rt2, { question: cur.question, item, selectedIndex: item.answerIndex, responseMs: 8000, plays: 1, confidence: 2, answerChanges: 0, firstChoiceWasCorrect: true }, (t2 += 10000));
      advance(data, rt2, t2);
    }
  });
  it('wrong answers are available only through the explicit review queue', () => {
    const q = reviewQueue(data);
    expect(q.length).toBeGreaterThan(0);
    expect(q.every((x) => !x.attempt.correct || x.attempt.confidence === 0)).toBe(true);
  });
});

describe('vocabulary weakness is recorded and re-scheduled', () => {
  it('missed vocabulary enters the list and comes back in a new format', () => {
    const data = createInitialData(NOW, { ...ETS_CATEGORIES });
    const rt = startSession(data, planToday(data, NOW), NOW, {}, 5);
    let t = NOW;
    for (let g = 0; g < 200; g++) {
      const cur = currentQuestion(data, rt, t);
      if (!cur) break;
      for (const item of itemsForMode(cur.question, 'training')) {
        const miss = cur.question.vocabularyTargets.length > 0;
        const wrongIdx = (item.answerIndex + 1) % item.choices.length;
        submitAnswer(data, rt, { question: cur.question, item, selectedIndex: miss ? wrongIdx : item.answerIndex, responseMs: 9000, plays: 1, confidence: 1, answerChanges: 0, firstChoiceWasCorrect: !miss }, (t += 10000));
      }
      advance(data, rt, t);
    }
    finishSession(data, rt, t);
    const words = Object.values(data.vocab);
    expect(words.length).toBeGreaterThan(0);
    expect(words.every((w) => w.mastery < 50)).toBe(true);
    // two days later the weak words are due and attached to vocabulary slots
    const later = planToday(data, t + 2 * DAY_MS);
    const targeted = later.slots.flatMap((s) => s.vocabTargets ?? []);
    expect(targeted.some((w) => data.vocab[w])).toBe(true);
  });
});

describe('two weeks of use (synthetic learner)', () => {
  const { report } = simulateDays({ days: 14, seed: 3 });
  it('no exact repeats in normal sessions', () => expect(report.exactRepeats).toBe(0));
  it('fills >= 95% of slots', () => {
    const planned = report.items; // items answered
    expect(report.failuresToGenerate).toBeLessThanOrEqual(Math.ceil(planned * 0.05));
  });
  it('sessions stay within 25-35 minutes', () => {
    for (const m of report.minutesPerSession) {
      expect(m).toBeGreaterThanOrEqual(25);
      expect(m).toBeLessThanOrEqual(35);
    }
  });
  it('skill estimates track the hidden true ability without systematic bias', () => {
    // ~40-120 answers per skill in 2 weeks => binomial noise of several points is unavoidable
    const skills = ['speaker_intent', 'extended_gist', 'implied_meaning', 'vocabulary', 'grammar'] as const;
    const errs = skills.map((s) => report.masteryEnd[s] - report.trueEnd[s]);
    const mae = errs.reduce((a, e) => a + Math.abs(e), 0) / errs.length;
    expect(mae).toBeLessThan(6);
    for (const e of errs) expect(Math.abs(e)).toBeLessThan(13);
  });
});
