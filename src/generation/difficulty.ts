/**
 * Difficulty calibrator. Difficulty is not "rare words": it comes from
 * paraphrase distance, trap strength, indirectness, information density.
 * The generator's label is blended with a feature-based estimate; learned
 * per-family offsets (from real answers) are applied by the skill model.
 */
import { clamp } from '../domain/rng';
import type { Difficulty, DistractorType, Question, QuestionItem } from '../domain/types';
import { contentTokens } from './fingerprint';

const STRONG: DistractorType[] = ['keyword_overlap', 'true_but_irrelevant', 'literal_interpretation', 'similar_sound', 'grammar_surface_match'];

export interface DifficultyFeatures {
  paraphraseDistance: number; // 0 = key copies source words, 1 = fully reworded
  strongTraps: number;
  scriptWords: number;
  indirect: boolean;
}

export function itemFeatures(q: Question, it: QuestionItem): DifficultyFeatures {
  const source = [q.passage ?? '', ...(q.audioScript ?? []).map((l) => l.text)].join(' ');
  const src = new Set(contentTokens(source));
  const keyTokens = contentTokens(it.choices[it.answerIndex]?.text ?? '');
  const overlap = keyTokens.length ? keyTokens.filter((t) => src.has(t)).length / keyTokens.length : 0;
  const strongTraps = it.choices.filter((c) => c.distractorType && STRONG.includes(c.distractorType)).length;
  const scriptWords = (q.audioScript ?? []).reduce((s, l) => s + l.text.split(/\s+/).length, 0);
  return {
    paraphraseDistance: source.trim() ? 1 - overlap : 0.5,
    strongTraps,
    scriptWords,
    indirect: it.skill === 'speaker_intent' || it.skill === 'implied_meaning' || it.skill === 'indirect_response',
  };
}

export function calibrateItem(q: Question, it: QuestionItem): { difficulty: Difficulty; note?: string } {
  const f = itemFeatures(q, it);
  let adj = 0;
  if (q.part !== 'P5' && q.part !== 'VOC' && q.part !== 'P2') {
    if (f.paraphraseDistance > 0.8) adj += 0.4;
    else if (f.paraphraseDistance < 0.35) adj -= 0.7; // key largely copies the script: easier than labelled
  }
  if (f.strongTraps >= 2) adj += 0.35;
  else if (f.strongTraps === 0) adj -= 0.35;
  if (f.scriptWords > 130) adj += 0.3;
  else if (f.scriptWords > 0 && f.scriptWords < 60) adj -= 0.2;
  const d = clamp(Math.round(it.difficulty + adj), 1, 5) as Difficulty;
  return { difficulty: d, note: d !== it.difficulty ? `difficulty ${it.difficulty}→${d} (paraphrase ${f.paraphraseDistance.toFixed(2)}, traps ${f.strongTraps})` : undefined };
}

export function calibrateQuestion(q: Question): { question: Question; notes: string[] } {
  const notes: string[] = [];
  const items = q.items.map((it) => {
    const r = calibrateItem(q, it);
    if (r.note) notes.push(r.note);
    return r.difficulty === it.difficulty ? it : { ...it, difficulty: r.difficulty };
  });
  const primary = items.find((i) => i.skill === q.skill && !i.trainingOnly) ?? items.find((i) => !i.trainingOnly) ?? items[0];
  return { question: { ...q, items, difficulty: primary.difficulty }, notes };
}
