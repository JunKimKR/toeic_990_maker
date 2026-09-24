/**
 * Quality gate, deliberately separate from the generators.
 *
 *  - styleCritic:        TOEIC-style & language sanity (slots, grammar heuristics)
 *  - answerValidator:    exactly one key, key consistent with explanation/evidence
 *  - distractorValidator: every distractor typed, distinct, not a near-copy of
 *                        the key, no length cue giving the answer away
 *
 * A question is shown to the learner only if it passes all hard checks and its
 * overall score is >= QUALITY_THRESHOLD. AI-generated questions additionally
 * pass an LLM critic on the server (blind solve) before they get here.
 */
import type { Question, QualityReview } from '../domain/types';
import { contentTokens, jaccard } from './fingerprint';

export const QUALITY_THRESHOLD = 70;

interface Issue {
  check: string;
  severity: 'hard' | 'major' | 'minor';
  msg: string;
}

const AN_EXCEPTIONS = /^(hour|honest|honor|heir|mba|fbi|nda|sms|faq|f\b|x\b|l\b|m\b|n\b|s\b|r\b)/i;
const A_EXCEPTIONS = /^(uni|use|usu|eu|one|once|ubiq|utili|uro|ukr)/i;

export function languageIssues(text: string, where: string): Issue[] {
  const out: Issue[] = [];
  if (/\{\w+\}/.test(text) || /\bundefined\b|\bNaN\b|\[object Object\]/.test(text)) out.push({ check: 'slots', severity: 'hard', msg: `${where}: unfilled slot` });
  const dbl = /\b(\w+)\s+\1\b/i.exec(text);
  if (dbl && !['had had', 'that that'].includes(dbl[0].toLowerCase())) out.push({ check: 'doubled_word', severity: 'major', msg: `${where}: doubled word "${dbl[0]}"` });
  const art = /\b(a|an)\s+([A-Za-z][\w-]*)/g;
  let m: RegExpExecArray | null;
  while ((m = art.exec(text))) {
    const [, a, w] = m;
    const vowel = /^[aeiou]/i.test(w);
    if (a.toLowerCase() === 'a' && vowel && !A_EXCEPTIONS.test(w)) out.push({ check: 'article', severity: 'major', msg: `${where}: "a ${w}"` });
    if (a.toLowerCase() === 'an' && !vowel && !AN_EXCEPTIONS.test(w)) out.push({ check: 'article', severity: 'major', msg: `${where}: "an ${w}"` });
  }
  if (/ {2,}/.test(text.replace(/\n/g, ''))) out.push({ check: 'spacing', severity: 'minor', msg: `${where}: double space` });
  const quotes = (text.match(/"/g) ?? []).length;
  if (quotes % 2 !== 0) out.push({ check: 'quotes', severity: 'minor', msg: `${where}: unbalanced quotes` });
  return out;
}

function styleCritic(q: Question): Issue[] {
  const issues: Issue[] = [];
  if (!q.items.length) issues.push({ check: 'items', severity: 'hard', msg: 'no items' });
  const lc = q.part === 'P2' || q.part === 'P3' || q.part === 'P4';
  if (lc && (!q.audioScript || q.audioScript.length === 0)) issues.push({ check: 'audio', severity: 'hard', msg: 'LC question without script' });
  for (const l of q.audioScript ?? []) {
    issues.push(...languageIssues(l.text, 'script'));
    if (!/^[A-Z"(0-9]/.test(l.text.trim())) issues.push({ check: 'capital', severity: 'minor', msg: 'script line not capitalized' });
  }
  if (q.passage) issues.push(...languageIssues(q.passage, 'passage'));
  for (const it of q.items) {
    issues.push(...languageIssues(it.stem, 'stem'));
    it.choices.forEach((c, i) => issues.push(...languageIssues(c.text, `choice${i}`)));
    if ((q.part === 'P5' || (q.part === 'VOC' && it.subskill === 'vocab_cloze')) && (it.stem.match(/_______/g) ?? []).length !== 1) {
      issues.push({ check: 'blank', severity: 'hard', msg: 'cloze stem must contain exactly one blank' });
    }
    const words = (q.audioScript ?? []).reduce((s, l) => s + l.text.split(' ').length, 0);
    if ((q.part === 'P3' || q.part === 'P4') && (words < 45 || words > 190)) issues.push({ check: 'length', severity: 'major', msg: `LC script length ${words} words outside TOEIC range` });
  }
  if (q.part === 'P3' || q.part === 'P4') {
    const exam = q.items.filter((i) => !i.trainingOnly).length;
    if (exam !== 3) issues.push({ check: 'set_size', severity: 'hard', msg: `set has ${exam} exam items (TOEIC sets have 3)` });
  }
  return issues;
}

function answerValidator(q: Question): Issue[] {
  const issues: Issue[] = [];
  const script = (q.audioScript ?? []).map((l) => l.text).join(' ');
  for (const it of q.items) {
    const n = it.choices.length;
    const expectedN = q.part === 'P2' ? 3 : 4;
    if (n !== expectedN) issues.push({ check: 'choice_count', severity: 'hard', msg: `expected ${expectedN} choices, got ${n}` });
    if (it.answerIndex < 0 || it.answerIndex >= n) issues.push({ check: 'key', severity: 'hard', msg: 'answer index out of range' });
    const key = it.choices[it.answerIndex];
    if (key?.distractorType) issues.push({ check: 'key', severity: 'hard', msg: 'key is labelled as a distractor' });
    const untyped = it.choices.filter((c, i) => i !== it.answerIndex && !c.distractorType).length;
    if (untyped > 0) issues.push({ check: 'key_unique', severity: 'hard', msg: 'more than one choice without a distractor type (possible 2 answers)' });
    if (!it.explanation.short || !it.explanation.detail) issues.push({ check: 'explanation', severity: 'major', msg: 'missing explanation' });
    if (q.part === 'P5' && key && !it.explanation.short.toLowerCase().includes(key.text.toLowerCase())) {
      issues.push({ check: 'explanation_key', severity: 'major', msg: 'explanation does not mention the key' });
    }
    if (it.quotedLine && !script.includes(it.quotedLine)) issues.push({ check: 'quote', severity: 'hard', msg: 'quoted line not in script' });
    if (it.evidenceLines?.some((i) => q.audioScript && (i < 0 || i >= q.audioScript.length))) issues.push({ check: 'evidence', severity: 'minor', msg: 'evidence line out of range' });
    // P5: the key must restore a sentence without doubled words
    if (q.part === 'P5' && key) {
      const restored = it.stem.replace('_______', key.text);
      if (/\b(\w+)\s+\1\b/i.test(restored)) issues.push({ check: 'restored', severity: 'major', msg: 'restored sentence has doubled word' });
    }
  }
  return issues;
}

function distractorValidator(q: Question): Issue[] {
  const issues: Issue[] = [];
  for (const it of q.items) {
    const texts = it.choices.map((c) => c.text.trim().toLowerCase());
    if (new Set(texts).size !== texts.length) issues.push({ check: 'distinct', severity: 'hard', msg: 'duplicate choices' });
    const key = it.choices[it.answerIndex];
    if (!key) continue;
    const kt = new Set(contentTokens(key.text));
    for (const [i, c] of it.choices.entries()) {
      if (i === it.answerIndex || it.trainingOnly) continue; // flow items differ in one step by design
      const sim = jaccard(kt, new Set(contentTokens(c.text)));
      if (kt.size >= 3 && sim >= 0.8) issues.push({ check: 'near_copy', severity: 'major', msg: `distractor ${i} nearly identical to key` });
    }
    // test-wiseness: the key should not be conspicuously the longest option
    if (q.part !== 'P5' && q.part !== 'P2' && !it.trainingOnly) {
      const others = it.choices.filter((_, i) => i !== it.answerIndex).map((c) => c.text.length);
      const avg = others.reduce((a, b) => a + b, 0) / Math.max(1, others.length);
      if (key.text.length > avg * 1.9 && key.text.length - avg > 25) issues.push({ check: 'length_cue', severity: 'major', msg: 'key much longer than distractors' });
    }
  }
  return issues;
}

export function reviewQuestion(q: Question): QualityReview {
  const issues = [...styleCritic(q), ...answerValidator(q), ...distractorValidator(q)];
  const hard = issues.some((i) => i.severity === 'hard');
  let score = 100;
  for (const i of issues) score -= i.severity === 'hard' ? 100 : i.severity === 'major' ? 25 : 6;
  score = Math.max(0, score);
  const checks: Record<string, boolean> = {};
  for (const i of issues) checks[i.check] = false;
  return { score, passed: !hard && score >= QUALITY_THRESHOLD, issues: issues.map((i) => `[${i.severity}] ${i.msg}`), checks };
}
