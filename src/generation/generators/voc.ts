/**
 * Vocabulary generator. Re-presents target words in rotating formats:
 *   cloze (Part 5 style) -> meaning in context -> paraphrase -> listening recognition
 * Each time with a different context frame and different fillers.
 */
import type { Difficulty, Question } from '../../domain/types';
import { VOCAB_FORMATS, VocabFormat } from '../../domain/vocabulary';
import { finalizeQuestion, makeItem } from '../build';
import { VOCAB, VOCAB_BY_WORD, VocabEntry } from '../content/vocabBank';
import { COMPANIES, CITIES, DAYS, MONTHS, person, fill } from '../lexicon';
import { freshWeight, GenContext, RawChoice } from '../genTypes';

/** Words whose meanings overlap enough to create two defensible answers. */
const MEANING_CLUSTERS: string[][] = [
  ['mandatory', 'imperative', 'prerequisite', 'eligible'],
  ['rigorous', 'stringent'],
  ['expedite', 'promptly', 'streamline'],
  ['tentative', 'preliminary', 'tentatively', 'temporarily', 'postpone'],
  ['reimburse', 'reimbursement', 'remittance', 'waive'],
  ['revenue', 'lucrative', 'quota'],
  ['verify', 'reconcile', 'discrepancy'],
  ['consolidate', 'streamline', 'allocate'],
  ['implement', 'commence', 'undergo'],
  ['obsolete', 'redundant', 'defective', 'fragile'],
  ['retain', 'renew', 'adhere', 'comply'],
  ['considerably', 'approximately'],
  ['periodically', 'consecutively'],
  ['durable', 'versatile', 'sustainable'],
  ['prominent', 'pertinent'],
  ['confidential', 'exclusively'],
  ['solicit', 'procure'],
];
const sameCluster = (a: string, b: string) => MEANING_CLUSTERS.some((c) => c.includes(a) && c.includes(b));

const POS_KO: Record<VocabEntry['pos'], string> = { v: '동사', n: '명사', adj: '형용사', adv: '부사' };

export function fillFrame(ctx: GenContext, frame: string): string {
  const p = person(ctx.rng, ctx.rng.chance(0.5) ? 'M' : 'W');
  return fill(frame, {
    company: ctx.rng.pick(COMPANIES),
    name: p.title,
    city: ctx.rng.pick(CITIES),
    day: ctx.rng.pick(DAYS),
    month: ctx.rng.pick(MONTHS),
  });
}

function pickEntry(ctx: GenContext): VocabEntry {
  const target = ctx.slot.vocabTargets?.map((w) => VOCAB_BY_WORD[w]).find(Boolean);
  if (target) return target;
  const d = ctx.slot.difficulty;
  return ctx.rng.weighted(VOCAB, (v) => (1 / (1 + Math.abs(v.level - d))) * freshWeight(ctx.novelty.lexicalKeys.get(`w:${v.word}`)));
}

function pickFormat(ctx: GenContext): VocabFormat {
  if (ctx.slot.part === 'P5') return 'cloze';
  const sub = ctx.slot.subskill as VocabFormat | undefined;
  if (sub && (VOCAB_FORMATS as readonly string[]).includes(sub)) return sub;
  if (ctx.slot.skill === 'paraphrase') return 'paraphrase';
  return ctx.rng.weighted(VOCAB_FORMATS, (f) => ({ cloze: 3, meaning: 2, paraphrase: 3, listening: 2 })[f]);
}

function otherSameCategory(ctx: GenContext, e: VocabEntry, n: number, key: (v: VocabEntry) => string): VocabEntry[] {
  const seen = new Set([key(e)]);
  const out: VocabEntry[] = [];
  for (const v of ctx.rng.shuffle(VOCAB.filter((v) => v.pos === e.pos && v.word !== e.word))) {
    const k = key(v);
    if (seen.has(k)) continue;
    // avoid synonyms overlapping with the target's synonyms (would create 2 answers)
    if (v.syn.some((s) => e.syn.includes(s)) || sameCluster(v.word, e.word)) continue;
    seen.add(k);
    out.push(v);
    if (out.length === n) break;
  }
  return out;
}

export function generateVocab(ctx: GenContext): Question | null {
  const e = pickEntry(ctx);
  const format = pickFormat(ctx);
  const fi = ctx.rng.weighted([0, 1], (i) => freshWeight(ctx.novelty.lexicalKeys.get(`vf:${e.word}:${i}`)));
  const frame = e.frames[fi];
  const sentenceWithWord = fillFrame(ctx, frame.replace('___', e.word));
  const sentenceBlank = sentenceWithWord.replace(new RegExp(`\\b${escapeRe(e.word)}\\b`), '_______');
  const skill = ctx.slot.skill === 'paraphrase' ? 'paraphrase' : 'vocabulary';
  let difficulty = (ctx.slot.isChallenge ? 5 : e.level) as Difficulty;
  let stem = '';
  let raw: RawChoice[] = [];
  let short = '';
  let detail = '';
  let passage: string | undefined;
  let audio: Question['audioScript'];

  const colloc = e.colloc.join(', ');
  switch (format) {
    case 'cloze': {
      stem = sentenceBlank;
      raw = [
        { text: e.word, correct: true },
        ...e.miss.map((m) => ({ text: m, type: 'collocation_mismatch' as const, rationale: `${m}: 형태는 비슷하지만 이 문맥(${colloc})에 맞지 않음` })),
      ];
      short = `${e.word}(${e.ko}) — ${colloc}.`;
      detail = `문맥상 "${e.syn[0]}"의 의미가 필요합니다. ${e.word}는 ${POS_KO[e.pos]}로 "${e.ko}"를 뜻하며 ${colloc} 형태로 자주 쓰입니다. 오답들은 철자·발음이 비슷하거나 같은 품사지만 이 연어와 어울리지 않습니다.`;
      break;
    }
    case 'meaning': {
      passage = sentenceWithWord;
      stem = `문맥상 "${e.word}"의 의미로 가장 적절한 것은?`;
      const others = otherSameCategory(ctx, e, 3, (v) => v.ko);
      if (others.length < 3) return null;
      raw = [{ text: e.ko, correct: true }, ...others.map((o) => ({ text: o.ko, type: 'meaning_mismatch' as const, rationale: `${o.ko}: ${o.word}의 뜻` }))];
      short = `${e.word} = ${e.ko} (${e.syn[0]}).`;
      detail = `"${e.word}"는 이 문장에서 "${e.syn.join(' / ')}"의 의미입니다. 자주 쓰이는 형태: ${colloc}.`;
      break;
    }
    case 'paraphrase': {
      passage = sentenceWithWord;
      stem = `In the sentence above, the word "${e.word}" is closest in meaning to`;
      const others = otherSameCategory(ctx, e, 2, (v) => v.syn[0]);
      if (others.length < 2) return null;
      const lookAlike = e.miss.find((m) => m[0] === e.word[0]) ?? e.miss[0];
      raw = [
        { text: e.syn[0], correct: true },
        ...others.map((o) => ({ text: o.syn[0], type: 'meaning_mismatch' as const, rationale: `${o.syn[0]}: 문맥과 무관한 의미` })),
        { text: lookAlike, type: 'similar_sound' as const, rationale: `${lookAlike}: 철자·발음이 비슷한 다른 단어` },
      ];
      difficulty = Math.max(difficulty, 3) as Difficulty;
      short = `${e.word} ≈ ${e.syn[0]}.`;
      detail = `Part 7의 동의어 문제는 사전적 의미가 아니라 "이 문장에서의" 의미를 묻습니다. 여기서 ${e.word}는 "${e.ko}" 즉 ${e.syn.join(' / ')}의 의미입니다. ${lookAlike}처럼 생김새가 비슷한 단어는 전형적인 함정입니다.`;
      break;
    }
    case 'listening': {
      passage = sentenceBlank;
      audio = [{ speaker: ctx.rng.chance(0.5) ? 'M' : 'W', text: sentenceWithWord, accent: ctx.rng.pick(['us', 'gb', 'au', 'ca'] as const) }];
      stem = 'Listen. The word you heard in the blank is closest in meaning to';
      const others = otherSameCategory(ctx, e, 3, (v) => v.syn[0]);
      if (others.length < 3) return null;
      raw = [{ text: e.syn[0], correct: true }, ...others.map((o) => ({ text: o.syn[0], type: 'meaning_mismatch' as const, rationale: `${o.syn[0]}: 들린 단어(${e.word})의 의미가 아님` }))];
      difficulty = Math.min(5, difficulty + 1) as Difficulty;
      short = `들린 단어: ${e.word} (${e.ko}) ≈ ${e.syn[0]}.`;
      detail = `듣기에서 어휘를 "인식"하고 곧바로 의미로 연결하는 훈련입니다. ${e.word}는 ${colloc}처럼 쓰입니다.`;
      break;
    }
  }

  const item = makeItem(ctx, {
    stem,
    raw,
    skill,
    subskill: `vocab_${format}`,
    difficulty,
    short,
    detail,
    secondarySkills: format === 'listening' ? ['paraphrase_recognition'] : format === 'paraphrase' && skill === 'vocabulary' ? ['paraphrase'] : undefined,
  });
  return finalizeQuestion(
    {
      part: ctx.slot.part === 'P5' ? 'P5' : 'VOC',
      skill,
      subskill: `vocab_${format}`,
      difficulty,
      passage,
      audioScript: audio,
      items: [item],
      vocabularyTargets: [e.word],
      situation: 'office',
      topic: `vocab:${e.pos}`,
      questionStructure: `voc.${format}`,
      reasoningPath: `voc.${e.word}.${format}`,
      templateId: `voc:${e.word}:${fi}`,
      estimatedSeconds: ctx.mode === 'training' ? 32 : 22,
      generatorDifficulty: difficulty,
      lexKeys: [`w:${e.word}`, `vf:${e.word}:${fi}`],
    },
    ctx.now,
  );
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
