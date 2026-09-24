import { createRng, uid } from '../src/domain/rng';
import type { BlueprintSlot, Question } from '../src/domain/types';
import { finalizeQuestion } from '../src/generation/build';
import { DuplicateDetector, toExposureRecord } from '../src/generation/duplicate';
import { generateP5Grammar } from '../src/generation/generators/p5';
import { emptyNovelty } from '../src/generation/genTypes';

const NOW = Date.UTC(2026, 3, 1);

function p5(stem: string, choices: string[], reasoningPath: string, templateId: string): Question {
  return finalizeQuestion(
    {
      part: 'P5',
      skill: 'grammar',
      subskill: 'preposition',
      difficulty: 3,
      items: [{ id: uid('it'), stem, choices: choices.map((t, i) => ({ text: t, distractorType: i ? 'grammar_surface_match' : undefined })), answerIndex: 0, skill: 'grammar', subskill: 'preposition', difficulty: 3, explanation: { short: 'by', detail: 'x' } }],
      vocabularyTargets: [],
      situation: 'office',
      topic: 'preposition',
      questionStructure: 'p5',
      reasoningPath,
      templateId,
      estimatedSeconds: 30,
    },
    NOW,
  );
}

describe('duplicate detector levels', () => {
  const a = p5('The report must be submitted _______ Friday.', ['by', 'until', 'since', 'within'], 'p5.prep_by_until', 'p5:prep_by_until:a');
  it('L1: exact duplicate is always rejected', () => {
    const det = new DuplicateDetector([toExposureRecord(a, NOW - 100 * 86400000)], NOW);
    const same = { ...a, id: 'other' };
    expect(det.check(same, NOW).level).toBe(1);
  });
  it('L4: "submitted ___ Friday" vs "received ___ Monday" = same grammar trick', () => {
    const det = new DuplicateDetector([toExposureRecord(a, NOW - 3600_000)], NOW);
    const b = p5('All applications should be received _______ Monday.', ['by', 'until', 'since', 'during'], 'p5.prep_by_until', 'p5:prep_by_until:b');
    const r = det.check(b, NOW);
    expect(r.ok).toBe(false);
    expect([4, 5]).toContain(r.level);
  });
  it('L2: lexically near-identical text is rejected even with a different template id', () => {
    const det = new DuplicateDetector([toExposureRecord(a, NOW - 3600_000)], NOW);
    const b = p5('The report must be submitted _______ Friday afternoon.', ['by', 'until', 'since', 'within'], 'p5.other', 'p5:other');
    const r = det.check(b, NOW);
    expect(r.ok).toBe(false);
    expect([1, 2, 5]).toContain(r.level);
  });
  it('allows a different rule with different wording', () => {
    const det = new DuplicateDetector([toExposureRecord(a, NOW - 3600_000)], NOW);
    const b = p5('Customers were _______ with the speed of the delivery service.', ['satisfied', 'satisfying', 'satisfy', 'satisfaction'], 'p5.participle_emotion', 'p5:participle_emotion:x');
    expect(det.check(b, NOW).ok).toBe(true);
  });
  it('the same trick is allowed again after its cooldown', () => {
    const det = new DuplicateDetector([toExposureRecord(a, NOW - 30 * 86400000)], NOW);
    // push 12 other P5 exposures in between
    const rng = createRng(3);
    const slot: BlueprintSlot = { id: 's', part: 'P5', skill: 'grammar', difficulty: 3, group: 'grammar', estimatedSeconds: 30, reason: '' };
    let added = 0;
    for (let i = 0; i < 200 && added < 12; i++) {
      const q = generateP5Grammar({ rng, slot, novelty: emptyNovelty(), mode: 'training', now: NOW });
      if (q && q.reasoningPath !== 'p5.prep_by_until' && det.check(q, NOW, 2).ok) {
        det.add(toExposureRecord(q, NOW - 1000 + i));
        added++;
      }
    }
    const b = p5('All applications should be received _______ Monday.', ['by', 'until', 'since', 'during'], 'p5.prep_by_until', 'p5:prep_by_until:b');
    expect(det.check(b, NOW).ok).toBe(true);
  });
});
