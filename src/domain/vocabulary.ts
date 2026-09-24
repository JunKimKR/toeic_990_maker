/**
 * Vocabulary weakness tracking.
 * Words enter the list when the learner misses them, answers slowly, or is
 * unsure. They come back in *new* contexts and *different formats*
 * (cloze -> meaning-in-context -> paraphrase -> listening recognition), on a
 * spaced schedule driven by mastery.
 */
import { clamp, DAY_MS } from './rng';
import type { Difficulty, VocabularyItem } from './types';

export const VOCAB_FORMATS = ['cloze', 'meaning', 'paraphrase', 'listening'] as const;
export type VocabFormat = (typeof VOCAB_FORMATS)[number];

export function newVocabItem(
  word: string,
  meaning: string,
  pos: string,
  context: string,
  collocations: string[],
  difficulty: Difficulty,
  reason: VocabularyItem['addedReason'],
  now: number,
): VocabularyItem {
  return {
    word,
    meaning,
    partOfSpeech: pos,
    context,
    collocations,
    difficulty,
    encounterCount: 0,
    correctCount: 0,
    slowCount: 0,
    lastSeen: now,
    mastery: reason === 'wrong' ? 25 : reason === 'unsure' ? 40 : 50,
    formatsSeen: [],
    addedReason: reason,
  };
}

export function recordVocabEncounter(
  item: VocabularyItem,
  r: { correct: boolean; slow: boolean; unsure: boolean; format: string; context?: string },
  now: number,
): VocabularyItem {
  let delta = r.correct ? (r.slow || r.unsure ? 6 : 14) : -18;
  if (r.correct && item.formatsSeen.length > 0 && !item.formatsSeen.includes(r.format)) delta += 4; // transfer to new format
  return {
    ...item,
    encounterCount: item.encounterCount + 1,
    correctCount: item.correctCount + (r.correct ? 1 : 0),
    slowCount: item.slowCount + (r.slow ? 1 : 0),
    lastSeen: now,
    mastery: clamp(item.mastery + delta, 0, 100),
    formatsSeen: item.formatsSeen.includes(r.format) ? item.formatsSeen : [...item.formatsSeen, r.format],
    context: r.context ?? item.context,
  };
}

/** Review interval in days for a mastery level (spaced repetition). */
export function intervalDays(mastery: number): number {
  if (mastery < 30) return 0.5;
  if (mastery < 50) return 1;
  if (mastery < 65) return 2;
  if (mastery < 80) return 4;
  if (mastery < 90) return 8;
  return 16;
}

export function isDue(item: VocabularyItem, now: number): boolean {
  return now - item.lastSeen >= intervalDays(item.mastery) * DAY_MS * 0.9;
}

/** Words to weave into today's session: due first, weakest first. */
export function weakVocabQueue(items: VocabularyItem[], now: number, max = 12): VocabularyItem[] {
  return items
    .filter((i) => i.mastery < 92)
    .map((i) => ({ i, due: isDue(i, now), score: i.mastery - (now - i.lastSeen) / DAY_MS }))
    .sort((a, b) => Number(b.due) - Number(a.due) || a.score - b.score)
    .slice(0, max)
    .map((x) => x.i);
}

/** Next format for a word: rotate formats so the word is met in new ways. */
export function nextVocabFormat(item: VocabularyItem | undefined): VocabFormat {
  if (!item) return 'cloze';
  const unseen = VOCAB_FORMATS.filter((f) => !item.formatsSeen.includes(f));
  if (unseen.length) return unseen[0];
  const idx = item.encounterCount % VOCAB_FORMATS.length;
  return VOCAB_FORMATS[idx];
}
