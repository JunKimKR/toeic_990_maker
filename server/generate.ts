/**
 * AI question generation on the server:
 *
 *   spec (from the app's blueprint)
 *     -> GENERATOR call (writes an original TOEIC-style draft as JSON)
 *     -> convert to app Question schema + reshuffle answer positions
 *     -> local critic (same code the app runs: src/generation/critic.ts)
 *     -> CRITIC call (separate prompt; solves the question BLIND, without the key,
 *        and flags ambiguity / unnaturalness / wrong difficulty)
 *     -> accept only if the blind answers match the key and no issue is flagged
 *
 * The generator never grades its own output.
 */
import { z } from 'zod';
import { createRng, hashString, uid } from '../src/domain/rng';
import type { Choice, Difficulty, DistractorType, Part, Question, SkillId, Situation } from '../src/domain/types';
import { finalizeQuestion } from '../src/generation/build';
import { reviewQuestion } from '../src/generation/critic';
import type { LlmProvider } from './llm';

const SITUATIONS = ['office', 'meeting', 'conference', 'travel', 'airport', 'hotel', 'restaurant', 'retail', 'shipping', 'manufacturing', 'customer_service', 'recruiting', 'hr', 'banking', 'real_estate', 'technology', 'training', 'marketing', 'accounting', 'contracts', 'events', 'maintenance'] as const;
const DISTRACTORS = ['keyword_overlap', 'true_but_irrelevant', 'wrong_person', 'wrong_time', 'opposite_meaning', 'literal_interpretation', 'reasonable_but_unstated', 'grammar_surface_match', 'similar_sound', 'wrong_question_type', 'wrong_form', 'collocation_mismatch', 'meaning_mismatch'] as const;
const SKILLS = ['short_gist', 'extended_gist', 'short_detail', 'extended_detail', 'speaker_intent', 'implied_meaning', 'next_action_prediction', 'paraphrase_recognition', 'negative_question', 'indirect_response', 'speaker_relationship', 'location_context', 'purpose_identification', 'visual_information_linking', 'vocabulary', 'grammar', 'inference', 'specific_information', 'cross_sentence_connection', 'paraphrase', 'reference', 'purpose', 'text_structure', 'multi_passage_synthesis', 'time_pressure_accuracy'] as const;

export interface GenSpec {
  part: Part;
  skill: SkillId;
  difficulty: Difficulty;
  itemSkills?: SkillId[];
  vocabTargets?: string[];
}

// ---------------------------------------------------------------------------
// Draft schema (what the generator must return)
// ---------------------------------------------------------------------------

const Draft = z.object({
  situation: z.enum(SITUATIONS),
  topic: z.string(),
  title: z.string().nullable(),
  passage: z.string().nullable(),
  audioScript: z.array(z.object({ speaker: z.enum(['M', 'W', 'M2', 'W2']), text: z.string() })),
  grammarPoint: z.string().nullable(),
  vocabularyTargets: z.array(z.string()),
  reasoningSummary: z.string(),
  items: z.array(
    z.object({
      stem: z.string(),
      skill: z.enum(SKILLS),
      subskill: z.string(),
      difficulty: z.number().int().min(1).max(5),
      correct: z.string(),
      distractors: z.array(z.object({ text: z.string(), type: z.enum(DISTRACTORS), why: z.string() })),
      explanationShort: z.string(),
      explanationDetail: z.string(),
      quotedLine: z.string().nullable(),
      evidenceLines: z.array(z.number().int()),
    }),
  ),
});
type DraftT = z.infer<typeof Draft>;

const draftJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['situation', 'topic', 'title', 'passage', 'audioScript', 'grammarPoint', 'vocabularyTargets', 'reasoningSummary', 'items'],
  properties: {
    situation: { type: 'string', enum: [...SITUATIONS] },
    topic: { type: 'string' },
    title: { type: ['string', 'null'] },
    passage: { type: ['string', 'null'] },
    audioScript: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['speaker', 'text'], properties: { speaker: { type: 'string', enum: ['M', 'W', 'M2', 'W2'] }, text: { type: 'string' } } } },
    grammarPoint: { type: ['string', 'null'] },
    vocabularyTargets: { type: 'array', items: { type: 'string' } },
    reasoningSummary: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['stem', 'skill', 'subskill', 'difficulty', 'correct', 'distractors', 'explanationShort', 'explanationDetail', 'quotedLine', 'evidenceLines'],
        properties: {
          stem: { type: 'string' },
          skill: { type: 'string', enum: [...SKILLS] },
          subskill: { type: 'string' },
          difficulty: { type: 'integer' },
          correct: { type: 'string' },
          distractors: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['text', 'type', 'why'], properties: { text: { type: 'string' }, type: { type: 'string', enum: [...DISTRACTORS] }, why: { type: 'string' } } } },
          explanationShort: { type: 'string' },
          explanationDetail: { type: 'string' },
          quotedLine: { type: ['string', 'null'] },
          evidenceLines: { type: 'array', items: { type: 'integer' } },
        },
      },
    },
  },
} as const;

const Critique = z.object({
  items: z.array(z.object({ chosen: z.string(), defensibleAlternatives: z.array(z.string()), ambiguous: z.boolean() })),
  naturalness: z.number().int().min(1).max(10),
  toeicLikeness: z.number().int().min(1).max(10),
  estimatedDifficulty: z.number().int().min(1).max(5),
  problems: z.array(z.string()),
});

const critiqueJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['items', 'naturalness', 'toeicLikeness', 'estimatedDifficulty', 'problems'],
  properties: {
    items: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['chosen', 'defensibleAlternatives', 'ambiguous'], properties: { chosen: { type: 'string' }, defensibleAlternatives: { type: 'array', items: { type: 'string' } }, ambiguous: { type: 'boolean' } } } },
    naturalness: { type: 'integer' },
    toeicLikeness: { type: 'integer' },
    estimatedDifficulty: { type: 'integer' },
    problems: { type: 'array', items: { type: 'string' } },
  },
} as const;

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

export const GENERATOR_SYSTEM = `You write ORIGINAL TOEIC-style practice questions for a Korean learner who scores about 900 and is aiming for 990.
Never copy or paraphrase real ETS/TOEIC questions; every script, sentence and option must be newly written.

What matters for this learner: they hear details well but lose the overall purpose of long talks, the speaker's intention, implied meaning, and indirect responses; vocabulary is the next gap. Difficulty must come from paraphrase distance, plausible distractors, indirectness and information density — never from obscure words, trick ambiguity, or specialist knowledge.

Format rules (match the real test):
- P2: one spoken question/statement (audioScript line 1) and exactly 3 spoken responses; the item stem is "Listen to the question and choose the best response."; exactly one response is appropriate, often indirect at difficulty 4-5; distractors reuse sounds/words from the question or answer a different question type.
- P3: a 2-speaker (M/W) workplace conversation of 6-9 turns (90-160 words); exactly 3 items in test order. Intent items quote a line exactly as spoken in "quotedLine" and the stem uses that exact quote.
- P4: a single-speaker talk (voicemail, announcement, meeting excerpt, broadcast, tour, workshop) of 80-150 words, speaker M or W for every line; exactly 3 items.
- P5: one sentence with exactly one blank written as _______ and 4 options; grammar or vocabulary point.
- VOC: a sentence in "passage" that uses a target word naturally; item asks for its meaning in context; 4 options.
- P6/P7: a short business text in "passage"; P7 has 2-3 items, P6 has a connector or sentence-insertion item.
- Every item has exactly one correct answer ("correct") plus distractors (3 for P2, otherwise 4 options total = 3 distractors), each labelled with its trap type and a one-line reason.
- The correct answer must be the only defensible answer to a careful native speaker. Distractors must be clearly wrong on reflection but tempting at speed.
- Do not make the correct option conspicuously longer or more specific than the distractors.
- explanationShort (1-2 lines) and explanationDetail are written in Korean; options and scripts in natural business English.
- evidenceLines are 0-based indexes into audioScript (LC) or []; reasoningSummary states in English, in one line, what the learner has to infer (used to detect repeated reasoning).`;

export const CRITIC_SYSTEM = `You are an independent TOEIC item reviewer. You did not write these questions.
Solve each item yourself WITHOUT any answer key, exactly as a strong test-taker would, using only the script/passage.
For each item report: the option you choose (copy its text exactly), any other option a careful native speaker could defend, and whether the item is ambiguous.
Then rate naturalness of the English (1-10), how close it is to real TOEIC style (1-10), the difficulty on a 1-5 scale (3 = average TOEIC item, 5 = hardest items at the 990 level), and list concrete problems (unnatural wording, two answers, no answer, answer leaked by wording, specialist knowledge needed, offensive or sensitive content). Be strict.`;

function specPrompt(s: GenSpec, avoid: { reasoningPaths: string[]; topics: string[] }): string {
  const skills = s.itemSkills?.length ? s.itemSkills : [s.skill];
  return [
    `Write one ${s.part} unit.`,
    `Primary skill: ${s.skill}. Item skills in order: ${skills.join(', ')}.`,
    `Target difficulty: ${s.difficulty} (1-5).`,
    s.vocabTargets?.length ? `Use these target words naturally in a NEW context: ${s.vocabTargets.join(', ')}.` : '',
    avoid.topics.length ? `Avoid these recently used topics/situations: ${avoid.topics.slice(-25).join('; ')}.` : '',
    avoid.reasoningPaths.length ? `Do not reuse these reasoning patterns: ${avoid.reasoningPaths.slice(-30).join('; ')}.` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function renderForCritic(q: Question): string {
  const lines: string[] = [];
  if (q.audioScript) q.audioScript.forEach((l, i) => lines.push(`[${i}] ${l.speaker}: ${l.text}`));
  if (q.passage) lines.push(`PASSAGE:\n${q.passage}`);
  q.items.forEach((it, i) => {
    lines.push(`\nITEM ${i + 1}: ${it.stem}`);
    it.choices.forEach((c, j) => lines.push(`  (${'ABCD'[j]}) ${c.text}`));
  });
  return lines.join('\n');
}

// ---------------------------------------------------------------------------

export function draftToQuestion(d: DraftT, s: GenSpec, seed: number, now: number): Question {
  const rng = createRng(seed);
  const items = d.items.map((it) => {
    const n = s.part === 'P2' ? 3 : 4;
    const ds = it.distractors.slice(0, n - 1);
    const pos = rng.int(0, ds.length);
    const choices: Choice[] = ds.map((x) => ({ text: x.text, distractorType: x.type as DistractorType, rationale: x.why }));
    choices.splice(pos, 0, { text: it.correct });
    return {
      id: uid('itai'),
      stem: it.stem,
      choices,
      answerIndex: pos,
      skill: it.skill as SkillId,
      subskill: it.subskill,
      difficulty: Math.min(5, Math.max(1, it.difficulty)) as Difficulty,
      explanation: { short: it.explanationShort, detail: it.explanationDetail },
      quotedLine: it.quotedLine ?? undefined,
      evidenceLines: it.evidenceLines,
    };
  });
  const audioScript =
    s.part === 'P2'
      ? [{ speaker: d.audioScript[0]?.speaker ?? 'M', text: d.audioScript[0]?.text ?? '' }, ...items[0].choices.map((c, i) => ({ speaker: (d.audioScript[0]?.speaker === 'M' ? 'W' : 'M') as 'M' | 'W', text: `${'ABC'[i]}. ${c.text}` }))]
      : d.audioScript.length
        ? d.audioScript
        : undefined;
  return finalizeQuestion(
    {
      part: s.part,
      skill: s.skill,
      subskill: `ai_${s.skill}`,
      difficulty: s.difficulty,
      title: d.title ?? undefined,
      passage: d.passage ?? undefined,
      audioScript,
      items,
      grammarPoint: d.grammarPoint ?? undefined,
      vocabularyTargets: d.vocabularyTargets,
      situation: d.situation as Situation,
      topic: d.topic,
      questionStructure: `ai.${s.part}.${items.map((i) => i.skill).join('+')}`,
      reasoningPath: `ai.${s.part.toLowerCase()}.${hashString(d.reasoningSummary.toLowerCase())}`,
      templateId: `ai:${hashString(d.topic + d.reasoningSummary)}`,
      estimatedSeconds: s.part === 'P3' || s.part === 'P4' ? 150 : s.part === 'P7' || s.part === 'P6' ? 150 : 32,
      sourceType: 'ai',
      generatorDifficulty: s.difficulty,
      lexKeys: d.vocabularyTargets.map((w) => `w:${w}`),
    },
    now,
  );
}

export interface GenOutcome {
  question: Question | null;
  reason?: string;
}

export async function generateOne(gen: LlmProvider, critic: LlmProvider, spec: GenSpec, avoid: { reasoningPaths: string[]; topics: string[] }, now = Date.now()): Promise<GenOutcome> {
  const draft = await gen.json({ system: GENERATOR_SYSTEM, user: specPrompt(spec, avoid), schema: Draft, jsonSchema: draftJsonSchema as unknown as Record<string, unknown> });
  const q = draftToQuestion(draft, spec, now ^ Math.floor(Math.random() * 1e9), now);
  const local = reviewQuestion(q);
  if (!local.passed) return { question: null, reason: `local critic: ${local.issues.slice(0, 3).join('; ')}` };
  if (avoid.reasoningPaths.includes(q.reasoningPath)) return { question: null, reason: 'repeated reasoning path' };

  const c = await critic.json({ system: CRITIC_SYSTEM, user: renderForCritic(q), schema: Critique, jsonSchema: critiqueJsonSchema as unknown as Record<string, unknown>, effort: 'medium' });
  if (c.items.length !== q.items.length) return { question: null, reason: 'critic item count mismatch' };
  for (const [i, it] of q.items.entries()) {
    const key = it.choices[it.answerIndex].text.trim().toLowerCase();
    const r = c.items[i];
    if (r.chosen.trim().toLowerCase() !== key) return { question: null, reason: `blind solve disagreed on item ${i + 1}` };
    if (r.ambiguous || r.defensibleAlternatives.length) return { question: null, reason: `item ${i + 1} ambiguous` };
  }
  if (c.naturalness < 7 || c.toeicLikeness < 6) return { question: null, reason: `low naturalness/style (${c.naturalness}/${c.toeicLikeness})` };
  if (c.problems.length > 1) return { question: null, reason: `critic problems: ${c.problems.slice(0, 2).join('; ')}` };
  // difficulty calibrator: average of generator label and independent estimate
  const calibrated = Math.round((spec.difficulty + c.estimatedDifficulty) / 2) as Difficulty;
  return { question: { ...q, difficulty: calibrated, qualityScore: Math.round((c.naturalness + c.toeicLikeness) * 5), qualityNotes: c.problems } };
}
