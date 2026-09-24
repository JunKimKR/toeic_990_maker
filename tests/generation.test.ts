/**
 * Bulk validation of the procedural generation system (no AI calls).
 * Generates several hundred questions through the full pipeline and checks
 * quality, answer-position bias, difficulty/skill/topic coverage and novelty.
 */
import { createRng, uid } from '../src/domain/rng';
import type { BlueprintSlot, Difficulty, Part, Question, SkillId } from '../src/domain/types';
import { reviewQuestion } from '../src/generation/critic';
import { DuplicateDetector } from '../src/generation/duplicate';
import { exactHash } from '../src/generation/fingerprint';
import { buildNovelty, emptyStats, materialize } from '../src/generation/pipeline';
import { generateP2 } from '../src/generation/generators/p2';
import { generateP3 } from '../src/generation/generators/p3';
import { generateP4 } from '../src/generation/generators/p4';
import { generateP5Grammar } from '../src/generation/generators/p5';
import { generateVocab } from '../src/generation/generators/voc';
import { generateP6, generateP7 } from '../src/generation/generators/reading';
import { emptyNovelty, Generator } from '../src/generation/genTypes';
import { finalizeQuestion } from '../src/generation/build';

const NOW = Date.UTC(2026, 3, 1);
const slot = (part: Part, skill: SkillId, difficulty: Difficulty = 4, itemSkills?: SkillId[]): BlueprintSlot => ({ id: uid('s'), part, skill, difficulty, group: 'intent', estimatedSeconds: 60, itemSkills, reason: '' });

const GENS: [string, Generator, BlueprintSlot][] = [
  ['P2', generateP2, slot('P2', 'indirect_response')],
  ['P3', generateP3, slot('P3', 'speaker_intent', 4, ['speaker_intent', 'extended_gist', 'next_action_prediction'])],
  ['P3b', generateP3, slot('P3', 'purpose_identification', 5, ['purpose_identification', 'implied_meaning', 'paraphrase_recognition'])],
  ['P4', generateP4, slot('P4', 'purpose_identification', 4, ['purpose_identification', 'speaker_intent', 'next_action_prediction'])],
  ['P5', generateP5Grammar, slot('P5', 'grammar', 4)],
  ['VOC', generateVocab, slot('VOC', 'vocabulary', 4)],
  ['P6', generateP6, slot('P6', 'cross_sentence_connection', 4)],
  ['P7', generateP7, slot('P7', 'inference', 4, ['inference', 'specific_information', 'purpose'])],
];

describe('every generator produces questions that pass the independent critic', () => {
  for (const [name, gen, s] of GENS) {
    it(`${name}: 60 raw generations, >= 95% pass quality, no hard failures`, () => {
      const rng = createRng(11);
      let pass = 0;
      const hard: string[] = [];
      for (let i = 0; i < 60; i++) {
        const q = gen({ rng, slot: s, novelty: emptyNovelty(), mode: 'training', now: NOW });
        expect(q).not.toBeNull();
        const r = reviewQuestion(q!);
        if (r.passed) pass++;
        hard.push(...r.issues.filter((x) => x.startsWith('[hard]')));
      }
      expect(hard).toEqual([]);
      expect(pass / 60).toBeGreaterThanOrEqual(0.95);
    });
  }
});

describe('critic rejects broken questions', () => {
  const good = generateP5Grammar({ rng: createRng(5), slot: slot('P5', 'grammar'), novelty: emptyNovelty(), mode: 'training', now: NOW })!;
  it('accepts the baseline', () => expect(reviewQuestion(good).passed).toBe(true));
  it('two possible answers (untyped second key)', () => {
    const it0 = good.items[0];
    const wrongIdx = (it0.answerIndex + 1) % 4;
    const bad = { ...good, items: [{ ...it0, choices: it0.choices.map((c, i) => (i === wrongIdx ? { text: c.text } : c)) }] };
    expect(reviewQuestion(bad).passed).toBe(false);
  });
  it('unfilled template slot', () => {
    const bad = { ...good, items: [{ ...good.items[0], stem: 'Please contact {name} by _______.' }] };
    expect(reviewQuestion(bad).passed).toBe(false);
  });
  it('duplicate choices', () => {
    const it0 = good.items[0];
    const bad = { ...good, items: [{ ...it0, choices: it0.choices.map((c, i) => (i === 3 ? { ...c, text: it0.choices[2].text } : c)) }] };
    expect(reviewQuestion(bad).passed).toBe(false);
  });
  it('quoted intent line missing from the script', () => {
    const p3 = generateP3({ rng: createRng(9), slot: slot('P3', 'speaker_intent', 4, ['speaker_intent', 'extended_gist', 'next_action_prediction']), novelty: emptyNovelty(), mode: 'exam', now: NOW })!;
    const idx = p3.items.findIndex((i) => i.quotedLine);
    const items = p3.items.map((it, i) => (i === idx ? { ...it, quotedLine: 'This sentence was never spoken.' } : it));
    expect(reviewQuestion({ ...p3, items }).passed).toBe(false);
  });
  it('bad article usage is penalised', () => {
    const bad = finalizeQuestion({ ...good, items: [{ ...good.items[0], stem: 'She bought a apple and an banana _______.' }] }, NOW);
    expect(reviewQuestion(bad).score).toBeLessThan(80);
  });
});

describe('pipeline over 400+ questions: novelty and distribution', () => {
  const rng = createRng(2026);
  const det = new DuplicateDetector([], NOW);
  const nov = buildNovelty([]);
  const stats = emptyStats();
  const out: Question[] = [];
  const plan: BlueprintSlot[] = [];
  const mix: [Part, SkillId, SkillId[] | undefined][] = [
    ['P3', 'speaker_intent', ['speaker_intent', 'extended_gist', 'next_action_prediction']],
    ['P3', 'extended_gist', ['extended_gist', 'implied_meaning', 'extended_detail']],
    ['P4', 'purpose_identification', ['purpose_identification', 'speaker_intent', 'next_action_prediction']],
    ['P2', 'indirect_response', undefined],
    ['P2', 'short_gist', undefined],
    ['P5', 'grammar', undefined],
    ['P5', 'grammar', undefined],
    ['VOC', 'vocabulary', undefined],
    ['P5', 'vocabulary', undefined],
    ['P7', 'inference', ['inference', 'specific_information', 'vocabulary']],
  ];
  for (let i = 0; i < 44; i++) for (const [p, s, is] of mix) plan.push(slot(p, s, ([3, 4, 4, 5] as Difficulty[])[i % 4], is));
  let t = NOW;
  for (const s of plan) {
    t += 60_000;
    const r = materialize({ slot: s, mode: 'training', now: t, rng, detector: det, novelty: nov, stats });
    if (r.question) out.push(r.question);
  }

  it('fills at least 90% of 440 slots', () => {
    expect(out.length / plan.length).toBeGreaterThanOrEqual(0.9);
  });
  it('never repeats an exact question', () => {
    const hashes = out.map(exactHash);
    expect(new Set(hashes).size).toBe(hashes.length);
  });
  it('every accepted question passed the quality gate', () => {
    for (const q of out) expect(q.qualityScore ?? 0).toBeGreaterThanOrEqual(70);
  });
  it('answer positions are not biased (each within ±35% of uniform)', () => {
    const c4 = [0, 0, 0, 0];
    const c3 = [0, 0, 0];
    for (const q of out) for (const it of q.items) (it.choices.length === 4 ? c4 : c3)[it.answerIndex]++;
    const check = (c: number[]) => {
      const n = c.reduce((a, b) => a + b, 0);
      for (const x of c) expect(Math.abs(x - n / c.length) / (n / c.length)).toBeLessThan(0.35);
    };
    check(c4);
    check(c3);
  });
  it('covers difficulties 2-5 and many skills', () => {
    const ds = new Set(out.flatMap((q) => q.items.map((i) => i.difficulty)));
    expect([3, 4, 5].every((d) => ds.has(d as Difficulty))).toBe(true);
    const skills = new Set(out.flatMap((q) => q.items.map((i) => i.skill)));
    expect(skills.size).toBeGreaterThanOrEqual(12);
  });
  it('LC situations are spread (no situation > 25% of LC sets)', () => {
    const lc = out.filter((q) => q.part === 'P3' || q.part === 'P4');
    const counts: Record<string, number> = {};
    for (const q of lc) counts[q.situation] = (counts[q.situation] ?? 0) + 1;
    for (const c of Object.values(counts)) expect(c / lc.length).toBeLessThan(0.25);
    expect(Object.keys(counts).length).toBeGreaterThanOrEqual(10);
  });
  it('grammar tricks are spread (no trick > 10% of grammar items)', () => {
    const g = out.filter((q) => q.part === 'P5' && q.skill === 'grammar');
    const counts: Record<string, number> = {};
    for (const q of g) counts[q.reasoningPath] = (counts[q.reasoningPath] ?? 0) + 1;
    for (const c of Object.values(counts)) expect(c / g.length).toBeLessThan(0.1);
  });
  it('reports rejects by level (the detector is actually working)', () => {
    const total = Object.values(stats.duplicateRejects).reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(0);
  });
});
