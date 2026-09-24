import { adaptOnResult, adaptSlot, createAdaptState, effectiveDifficulty } from '../src/domain/adaptation';
import { inferMistakeCauses, diagnose } from '../src/domain/errorAnalysis';
import type { BlueprintSlot } from '../src/domain/types';

const slot: BlueprintSlot = { id: 's', part: 'P3', skill: 'speaker_intent', difficulty: 3, group: 'intent', estimatedSeconds: 150, reason: '' };
const ok = { skill: 'speaker_intent' as const, correct: true, credit: 1, fast: true, difficulty: 3 as const, causes: [] };

describe('in-session adaptation', () => {
  it('raises difficulty after 3 fast correct answers', () => {
    let st = createAdaptState();
    for (let i = 0; i < 3; i++) st = adaptOnResult(st, ok);
    expect(effectiveDifficulty(slot, st)).toBeGreaterThanOrEqual(4);
    expect(st.log.join()).toContain('3연속');
  });
  it('lowers difficulty after 3 misses at a hard level and focuses the dominant cause', () => {
    let st = createAdaptState();
    for (let i = 0; i < 3; i++) st = adaptOnResult(st, { ...ok, correct: false, credit: 0, fast: false, difficulty: 4, causes: ['literal_interpretation'] });
    const hard = { ...slot, difficulty: 4 as const };
    expect(effectiveDifficulty(hard, st)).toBeLessThanOrEqual(3);
    expect(adaptSlot(hard, st).focusCause).toBe('literal_interpretation');
  });
  it('is smoothed: a single miss does not swing difficulty', () => {
    let st = createAdaptState();
    st = adaptOnResult(st, ok);
    st = adaptOnResult(st, { ...ok, correct: false, credit: 0 });
    expect(effectiveDifficulty(slot, st)).toBe(3);
  });
  it('challenge slots stay at 5', () => {
    expect(effectiveDifficulty({ ...slot, isChallenge: true }, createAdaptState())).toBe(5);
  });
});

describe('mistake cause inference', () => {
  const base = { part: 'P3' as const, correct: false, responseMs: 12000, typicalMs: 14000, plays: 1, confidence: 1 as const, answerChanges: 0, firstChoiceWasCorrect: false, timedOut: false };
  it('detail heard but purpose missed -> missed_gist', () => {
    const c = inferMistakeCauses({ ...base, skill: 'purpose_identification', chosenDistractor: 'true_but_irrelevant' });
    expect(c[0]).toBe('missed_gist');
    expect(diagnose({ ...base, skill: 'purpose_identification', chosenDistractor: 'true_but_irrelevant' }, c)).toContain('가능성');
  });
  it('literal reading of an intent line -> literal_interpretation', () => {
    expect(inferMistakeCauses({ ...base, skill: 'speaker_intent', chosenDistractor: 'literal_interpretation' })[0]).toBe('literal_interpretation');
  });
  it('keyword trap -> distractor_keyword_match, plus intent failure for intent items', () => {
    const c = inferMistakeCauses({ ...base, skill: 'implied_meaning', chosenDistractor: 'keyword_overlap' });
    expect(c).toEqual(expect.arrayContaining(['distractor_keyword_match', 'speaker_intent_failure']));
  });
  it('changing a correct first choice -> overthinking', () => {
    expect(inferMistakeCauses({ ...base, skill: 'grammar', part: 'P5', chosenDistractor: 'grammar_surface_match', answerChanges: 1, firstChoiceWasCorrect: true })).toContain('overthinking');
  });
  it('confident wrong answers are flagged for priority correction', () => {
    const s = { ...base, skill: 'grammar' as const, part: 'P5' as const, chosenDistractor: 'grammar_surface_match' as const, confidence: 2 as const };
    expect(diagnose(s, inferMistakeCauses(s))).toContain('확신한 오답');
  });
  it('correct answers have no causes', () => {
    expect(inferMistakeCauses({ ...base, correct: true, skill: 'grammar', chosenDistractor: null })).toEqual([]);
  });
});
