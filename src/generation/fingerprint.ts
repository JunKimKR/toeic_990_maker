/**
 * Fingerprints used by the multi-level duplicate detector.
 */
import { hashString } from '../domain/rng';
import type { Question } from '../domain/types';
import { FEMALE_FIRST, LAST, MALE_FIRST, COMPANIES, CITIES, DAYS, MONTHS } from './lexicon';

const STOP = new Set(
  'a an the of to in on at for by with from and or but is are was were be been being has have had will would can could should may might must do does did this that these those it its their there here as if so than then about into over after before during our your his her we you they he she i me my us them which who whom whose what when where why how not no all any each some more most very also just only please mr ms'.split(' '),
);

const NAME_SET = new Set([...MALE_FIRST, ...FEMALE_FIRST, ...LAST, ...DAYS, ...MONTHS].map((s) => s.toLowerCase()));
const MULTI = [...COMPANIES, ...CITIES].map((s) => s.toLowerCase());

export function questionText(q: Question): string {
  const parts: string[] = [];
  if (q.passage) parts.push(q.passage);
  if (q.audioScript) parts.push(q.audioScript.map((l) => l.text).join(' '));
  for (const it of q.items) {
    parts.push(it.stem);
    parts.push(it.choices.map((c) => c.text).join(' '));
  }
  return parts.join(' ');
}

export function normalize(s: string): string {
  let t = s.toLowerCase();
  for (const m of MULTI) t = t.split(m).join(' ⟨e⟩ ');
  return t
    .replace(/[0-9]+([:.,][0-9]+)*/g, ' ⟨n⟩ ')
    .replace(/[^a-z⟨⟩ ']/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (NAME_SET.has(w) ? '⟨p⟩' : w))
    .join(' ');
}

/** Content words (names/numbers/entities masked, stopwords removed). */
export function contentTokens(s: string): string[] {
  return normalize(s)
    .split(' ')
    .filter((w) => w.length > 2 && !STOP.has(w) && !w.startsWith('⟨'));
}

export function shingles(tokens: string[], k = 3): Set<string> {
  const out = new Set<string>();
  if (tokens.length < k) {
    if (tokens.length) out.add(tokens.join(' '));
    return out;
  }
  for (let i = 0; i + k <= tokens.length; i++) out.add(tokens.slice(i, i + k).join(' '));
  return out;
}

export function jaccard<T>(a: Set<T>, b: Set<T>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

/** Function-word skeleton of the main stem: captures sentence structure. */
export function skeleton(s: string): string {
  return normalize(s)
    .split(' ')
    .map((w) => (STOP.has(w) || w === '_______' ? w : w.startsWith('⟨') ? w : '•'))
    .join(' ')
    .replace(/(• )+/g, '• ');
}

export function answerPattern(q: Question): string {
  const it = q.items[0];
  if (!it) return '';
  if (q.part === 'P5' || q.part === 'VOC') {
    const set = it.choices.map((c) => c.text.toLowerCase()).sort().join('|');
    // vocabulary: the same word/choices in a NEW context sentence is the intended
    // spaced re-exposure, so the context frame is part of the pattern
    return hashString(q.reasoningPath.startsWith('voc.') ? `${set}#${q.templateId}` : set);
  }
  return hashString(q.items.map((i) => `${i.skill}:${i.choices[i.answerIndex]?.text.toLowerCase()}`).join('|'));
}

export function exactHash(q: Question): string {
  return hashString(normalize(questionText(q)));
}

export function computeSemanticFingerprint(q: Question): string {
  return hashString(`${q.part}|${q.reasoningPath}|${q.situation}|${answerPattern(q)}`);
}
