/** Part 5 grammar generator: picks a fresh trick near the target difficulty. */
import { clamp } from '../../domain/rng';
import type { Difficulty, Question } from '../../domain/types';
import { finalizeQuestion, makeItem } from '../build';
import { makeVars, TRICKS, Trick } from '../content/part5Tricks';
import { freshWeight, GenContext } from '../genTypes';

export function trickDifficulty(t: Trick, target: Difficulty): number {
  return 1 / (1 + Math.abs(t.difficulty - target) * 1.5);
}

export function generateP5Grammar(ctx: GenContext): Question | null {
  const { rng, slot, novelty } = ctx;
  const trick = rng.weighted(TRICKS, (t) => trickDifficulty(t, slot.difficulty) * freshWeight(novelty.reasoningCounts.get(`p5.${t.id}`)));
  // sample a few builds and keep the one with the freshest lexical key
  let best: ReturnType<Trick['build']> | null = null;
  let bestW = -1;
  for (let i = 0; i < 4; i++) {
    const out = trick.build(rng, makeVars(rng));
    const w = freshWeight(novelty.lexicalKeys.get(out.lexKey)) + rng.next() * 0.01;
    if (w > bestW) {
      best = out;
      bestW = w;
    }
  }
  if (!best) return null;
  const out = best;
  // time-pressure slots: same item, stricter timer handled by UI; label skill accordingly
  const skill = slot.skill === 'time_pressure_accuracy' ? 'time_pressure_accuracy' : 'grammar';
  // intervening-phrase length adds difficulty
  const wordCount = out.sentence.split(/\s+/).length;
  const difficulty = clamp((out.difficulty ?? trick.difficulty) + (wordCount > 17 ? 1 : 0) - (wordCount < 10 ? 1 : 0), 1, 5) as Difficulty;
  const item = makeItem(ctx, {
    stem: out.sentence,
    raw: [{ text: out.answer, correct: true }, ...out.distractors.map((x) => ({ text: x.text, type: x.type, rationale: x.why }))],
    skill,
    subskill: trick.point,
    difficulty,
    short: out.short,
    detail: out.detail,
  });
  return finalizeQuestion(
    {
      part: 'P5',
      skill,
      subskill: trick.point,
      difficulty,
      items: [item],
      grammarPoint: trick.label,
      vocabularyTargets: out.vocab ?? [],
      situation: 'office',
      topic: trick.point,
      questionStructure: `p5.${trick.point}.${trick.id}`,
      reasoningPath: `p5.${trick.id}`,
      templateId: `p5:${trick.id}:${hashFrame(out.sentence)}`,
      estimatedSeconds: ctx.mode === 'training' ? 32 : 22,
      generatorDifficulty: difficulty,
      lexKeys: [out.lexKey],
    },
    ctx.now,
  );
}

/** Frame identity = sentence with lexical slots masked (structure-level id). */
function hashFrame(s: string): string {
  return s
    .replace(/[A-Z][a-z]+ [A-Z][a-z]+/g, 'N')
    .replace(/\b(Mr|Ms)\. [A-Z][a-z]+/g, 'N')
    .split(' ')
    .slice(0, 5)
    .join('_')
    .toLowerCase();
}
