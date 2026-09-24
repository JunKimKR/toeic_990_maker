import type { Rng } from '../../domain/rng';
import type { Accent, Difficulty, DistractorType, ScriptLine } from '../../domain/types';
import { contentTokens } from '../fingerprint';
import type { RawChoice } from '../genTypes';

export interface OptLike {
  text: string;
  type: DistractorType;
}

/** Stronger traps are preferred at higher difficulty. */
const STRENGTH: Partial<Record<DistractorType, number>> = {
  keyword_overlap: 3,
  true_but_irrelevant: 3,
  literal_interpretation: 3,
  opposite_meaning: 2,
  wrong_person: 2,
  wrong_time: 2,
  reasonable_but_unstated: 1.5,
  similar_sound: 3,
  wrong_question_type: 1,
};

export function pickDistractors(rng: Rng, opts: OptLike[], n: number, difficulty: Difficulty, correct: string): OptLike[] {
  const uniq = opts.filter((o, i) => o.text !== correct && opts.findIndex((x) => x.text.toLowerCase() === o.text.toLowerCase()) === i);
  const exp = (difficulty - 3) * 0.6; // d5 strongly prefers strong traps; d2 prefers weak ones
  const weighted = uniq.map((o) => ({ o, w: Math.pow(STRENGTH[o.type] ?? 1.5, exp) * (0.6 + rng.next()) }));
  weighted.sort((a, b) => b.w - a.w);
  return weighted.slice(0, n).map((x) => x.o);
}

/**
 * Keep distractor-type labels honest: a "true but irrelevant" / "keyword overlap"
 * option must actually share content with the script, otherwise it is just an
 * unsupported guess.
 */
export function relabel(o: OptLike, script: string): OptLike {
  if (o.type !== 'true_but_irrelevant' && o.type !== 'keyword_overlap') return o;
  const scriptTokens = new Set(contentTokens(script));
  const shared = contentTokens(o.text).filter((t) => t.length > 3 && scriptTokens.has(t));
  return shared.length ? o : { ...o, type: 'reasonable_but_unstated' };
}

export function toRaw(correct: string, ds: OptLike[], why: (o: OptLike) => string): RawChoice[] {
  return [{ text: correct, correct: true }, ...ds.map((d) => ({ text: d.text, type: d.type, rationale: why(d) }))];
}

/** Merge consecutive lines of the same speaker. */
export function mergeTurns(lines: ScriptLine[]): ScriptLine[] {
  const out: ScriptLine[] = [];
  for (const l of lines) {
    if (!l.text.trim()) continue;
    const last = out[out.length - 1];
    if (last && last.speaker === l.speaker) last.text = `${last.text} ${l.text}`;
    else out.push({ ...l });
  }
  return out;
}

export function scriptSeconds(lines: ScriptLine[]): number {
  const words = lines.reduce((s, l) => s + l.text.split(/\s+/).length, 0);
  return Math.round(words / 2.5 + lines.length * 0.6);
}

export function pickAccents(rng: Rng): [Accent, Accent] {
  const acc: Accent[] = ['us', 'gb', 'au', 'ca'];
  const a = rng.pick(acc);
  const b = rng.pick(acc.filter((x) => x !== a));
  return [a, b];
}

export const TYPE_KO: Record<DistractorType, string> = {
  keyword_overlap: '지문 단어를 그대로 재사용한 함정',
  true_but_irrelevant: '언급은 되었지만 질문의 답은 아님',
  wrong_person: '다른 사람에 관한 내용',
  wrong_time: '다른 시점/일정',
  opposite_meaning: '화자 의도와 반대',
  literal_interpretation: '문장의 표면적 의미만 해석',
  reasonable_but_unstated: '그럴듯하지만 근거 없음',
  grammar_surface_match: '표면 형태 일치',
  similar_sound: '유사 발음',
  wrong_question_type: '질문 유형 불일치',
  wrong_form: '형태 오류',
  collocation_mismatch: '연어 불일치',
  meaning_mismatch: '의미 불일치',
};

/** Drop options that share a content word with the key (e.g. "radio host" vs "radio reporter"). */
export function distinctFrom<T extends { text: string }>(answer: string, opts: T[]): T[] {
  const key = new Set(contentTokens(answer).filter((t) => t.length >= 4));
  return opts.filter((o) => !contentTokens(o.text).some((t) => key.has(t)));
}
