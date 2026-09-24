/**
 * Multi-level duplicate / repetition detector.
 *
 *  L1 exact duplicate (ever)                          -> always reject
 *  L2 lexical similarity (content 3-shingle Jaccard)  -> reject >= 0.45 in window
 *  L3 structure (template / sentence skeleton)        -> cooldown per part
 *  L4 same grammar trick (P5)                          -> cooldown
 *  L5 same answer pattern (same choice set / key)     -> reject in window
 *  L6 same situation back-to-back (LC sets)           -> soft
 *  L7 same semantic reasoning path                    -> cooldown (14 days)
 *
 * The window is: everything shown in the last 14 days UNION the last 200 items.
 * `strictness` lets the pipeline relax *soft* levels (L3/L6, then L7 halving)
 * when the content space for a slot is exhausted — never L1/L2/L5.
 */
import { DAY_MS } from '../domain/rng';
import type { Part, Question, Situation } from '../domain/types';
import { answerPattern, contentTokens, exactHash, jaccard, questionText, shingles, skeleton } from './fingerprint';

export interface ExposureRecord {
  questionId: string;
  at: number;
  part: Part;
  exact: string;
  shingles: string[];
  skeleton: string;
  templateId: string;
  reasoningPath: string;
  answerPattern: string;
  situation: Situation;
  topic: string;
  lexKeys: string[];
  answerPositions: number[];
}

export function toExposureRecord(q: Question, at: number): ExposureRecord {
  return {
    questionId: q.id,
    at,
    part: q.part,
    exact: exactHash(q),
    shingles: [...shingles(contentTokens(questionText(q)))],
    skeleton: skeleton(q.items[0]?.stem ?? ''),
    templateId: q.templateId,
    reasoningPath: q.reasoningPath,
    answerPattern: answerPattern(q),
    situation: q.situation,
    topic: q.topic,
    lexKeys: q.lexKeys ?? [],
    answerPositions: q.items.map((i) => i.answerIndex),
  };
}

export interface DupResult {
  ok: boolean;
  level?: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  reason?: string;
  maxLexical: number;
  /** 0..1, higher = more novel; used to rank candidates */
  novelty: number;
}

/** cooldowns: number of later same-part exposures required before reuse */
const TEMPLATE_COOLDOWN: Record<Part, number> = { P2: 25, P3: 10, P4: 6, P5: 30, VOC: 15, P6: 4, P7: 4 };
const PATH_COOLDOWN_DAYS: Record<Part, number> = { P2: 10, P3: 14, P4: 14, P5: 0, VOC: 14, P6: 7, P7: 7 };
const PATH_COOLDOWN_COUNT: Record<Part, number> = { P2: 40, P3: 20, P4: 12, P5: 10, VOC: 30, P6: 5, P7: 5 };

export class DuplicateDetector {
  private window: ExposureRecord[];
  private everExact: Set<string>;
  private shingleCache = new Map<string, Set<string>>();

  constructor(history: ExposureRecord[], now: number, everExact?: Iterable<string>) {
    const sorted = history.slice().sort((a, b) => a.at - b.at);
    const recentByTime = sorted.filter((r) => now - r.at <= 14 * DAY_MS);
    const last200 = sorted.slice(-200);
    const ids = new Set<string>();
    this.window = [...recentByTime, ...last200].filter((r) => (ids.has(r.questionId + r.at) ? false : (ids.add(r.questionId + r.at), true)));
    this.window.sort((a, b) => a.at - b.at);
    this.everExact = new Set(everExact ?? history.map((h) => h.exact));
  }

  /** Register a question as shown (so later checks in the same session see it). */
  add(r: ExposureRecord) {
    this.window.push(r);
    this.everExact.add(r.exact);
  }

  get records(): readonly ExposureRecord[] {
    return this.window;
  }

  private sh(r: ExposureRecord): Set<string> {
    let s = this.shingleCache.get(r.questionId + r.at);
    if (!s) {
      s = new Set(r.shingles);
      this.shingleCache.set(r.questionId + r.at, s);
    }
    return s;
  }

  check(q: Question, now: number, strictness: 0 | 1 | 2 = 0): DupResult {
    const rec = toExposureRecord(q, now);
    if (this.everExact.has(rec.exact)) return { ok: false, level: 1, reason: 'exact duplicate', maxLexical: 1, novelty: 0 };

    const qs = new Set(rec.shingles);
    let maxLex = 0;
    for (const r of this.window) {
      const j = jaccard(qs, this.sh(r));
      if (j > maxLex) maxLex = j;
    }
    if (maxLex >= 0.45) return { ok: false, level: 2, reason: `lexical similarity ${maxLex.toFixed(2)}`, maxLexical: maxLex, novelty: 1 - maxLex };

    const samePart = this.window.filter((r) => r.part === q.part);
    const since = (pred: (r: ExposureRecord) => boolean) => {
      for (let i = samePart.length - 1; i >= 0; i--) if (pred(samePart[i])) return samePart.length - 1 - i;
      return Infinity;
    };

    // L5 answer pattern (same choice set / same key sequence)
    if ((q.part === 'P5' || q.part === 'VOC') && this.window.some((r) => r.answerPattern === rec.answerPattern && r.part === q.part)) {
      return { ok: false, level: 5, reason: 'same answer pattern in window', maxLexical: maxLex, novelty: 0.2 };
    }

    // L7 semantic reasoning path (includes L4 grammar trick for P5)
    const pathGap = since((r) => r.reasoningPath === rec.reasoningPath);
    const lastPath = [...samePart].reverse().find((r) => r.reasoningPath === rec.reasoningPath);
    const pathDays = PATH_COOLDOWN_DAYS[q.part] / (strictness >= 2 ? 2 : 1);
    const pathCount = PATH_COOLDOWN_COUNT[q.part] / (strictness >= 2 ? 2 : 1);
    if (lastPath && (now - lastPath.at < pathDays * DAY_MS || pathGap < pathCount)) {
      const level = q.part === 'P5' ? 4 : 7;
      return { ok: false, level, reason: `${level === 4 ? 'same grammar trick' : 'same reasoning path'} (${pathGap} items ago)`, maxLexical: maxLex, novelty: 0.3 };
    }

    // L3 structure / template
    if (strictness < 1) {
      const tGap = since((r) => r.templateId === rec.templateId);
      if (tGap < TEMPLATE_COOLDOWN[q.part]) return { ok: false, level: 3, reason: `same template ${tGap} items ago`, maxLexical: maxLex, novelty: 0.4 };
      const skGap = q.part === 'P5' ? since((r) => r.skeleton === rec.skeleton) : Infinity;
      if (skGap < 6) return { ok: false, level: 3, reason: 'same sentence skeleton', maxLexical: maxLex, novelty: 0.4 };
    }

    // L6 situation back-to-back for LC sets
    if (strictness < 1 && (q.part === 'P3' || q.part === 'P4')) {
      const last2 = samePart.slice(-2);
      if (last2.some((r) => r.situation === q.situation)) return { ok: false, level: 6, reason: 'same situation as recent set', maxLexical: maxLex, novelty: 0.5 };
    }

    const lexPenalty = rec.lexKeys.some((k) => this.window.slice(-40).some((r) => r.lexKeys.includes(k))) ? 0.15 : 0;
    return { ok: true, maxLexical: maxLex, novelty: Math.max(0, 1 - maxLex - lexPenalty) };
  }
}
