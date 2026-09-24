/**
 * Session summary, pattern detection, next-session focus, performance
 * achievements, and objective readiness indicators (no fake score prediction).
 */
import { causeLabel, DISTRACTOR_LABEL } from './errorAnalysis';
import { masteryFromTheta } from './skillModel';
import { LC_SKILLS, RC_SKILLS, SKILLS } from './skills';
import type { Attempt, DistractorType, MistakeCause, SessionSummary, SkillId, SkillState } from './types';

export function countBy<T extends string>(xs: T[]): { key: T; count: number }[] {
  const m = new Map<T, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  return [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
}

const PATTERN_TEXT: Partial<Record<MistakeCause, (skill: string) => string>> = {
  missed_gist: (s) => `${s} 문제에서 언급된 세부 정보를 정답으로 고르는 경향이 보였습니다. 세부는 들리지만 "그래서 왜?"를 통합하는 단계에서 손실이 있습니다.`,
  literal_interpretation: (s) => `${s} 문제에서 문장의 표면 의미를 그대로 고른 오답이 많았습니다.`,
  speaker_intent_failure: (s) => `${s} 문제에서 화자가 그 말을 한 이유를 놓친 오답이 많았습니다.`,
  distractor_keyword_match: (s) => `${s} 문제에서 지문의 단어가 그대로 들어간 함정 보기를 자주 골랐습니다.`,
  missed_detail: (s) => `${s} 문제에서 사람·시점 등 세부 정보를 혼동한 오답이 있었습니다.`,
  inference_error: (s) => `${s} 문제에서 근거 없이 그럴듯한 보기를 고른 경우가 있었습니다.`,
  grammar_rule_confusion: (s) => `${s} 문제에서 빈칸 주변만 보고 형태를 고른 오답이 있었습니다.`,
  vocabulary_gap: (s) => `${s} 문제에서 어휘 의미/연어가 불확실했던 것으로 보입니다.`,
  overthinking: (s) => `${s} 문제에서 처음 판단을 바꾸거나 오래 고민한 뒤 틀린 경우가 많았습니다.`,
  missed_paraphrase: (s) => `${s} 문제에서 바꿔 말한 표현을 연결하지 못한 경우가 있었습니다.`,
  time_pressure: () => '제한 시간 내에 답하지 못한 문제가 있었습니다.',
};

export function summarizeSession(
  attempts: Attempt[],
  before: Partial<Record<SkillId, number>>,
  after: Partial<Record<SkillId, number>>,
  startedAt: number,
  endedAt: number,
  nextFocus: string[],
  achievements: string[],
): SessionSummary {
  const n = attempts.length;
  const correct = attempts.filter((a) => a.correct).length;
  const lc = attempts.filter((a) => a.firstListenCorrect !== null);
  const fl = lc.length ? lc.filter((a) => a.firstListenCorrect).length / lc.length : null;
  const avgResp = n ? attempts.reduce((s, a) => s + a.responseMs, 0) / n / 1000 : 0;
  const deltas = (Object.keys(after) as SkillId[])
    .filter((s) => before[s] !== undefined)
    .map((s) => ({ skill: s, before: before[s]!, after: after[s]! }))
    .filter((d) => Math.abs(d.after - d.before) >= 0.05)
    .sort((a, b) => b.after - b.before - (a.after - a.before));
  const biggestGain = deltas.length && deltas[0].after > deltas[0].before ? deltas[0] : null;
  const wrong = attempts.filter((a) => !a.correct);
  const topCauses = countBy(wrong.flatMap((a) => a.mistakeCauses.slice(0, 1))).slice(0, 3).map((c) => ({ cause: c.key, count: c.count }));
  const topTraps = countBy(wrong.map((a) => a.chosenDistractorType).filter((x): x is DistractorType => !!x))
    .slice(0, 3)
    .map((t) => ({ type: t.key, count: t.count }));
  const hd = attempts.filter((a) => a.difficulty >= 5);
  return {
    accuracy: n ? correct / n : 0,
    items: n,
    correct,
    durationSec: Math.round((endedAt - startedAt) / 1000),
    firstListenAccuracy: fl,
    avgResponseSec: avgResp,
    biggestGain,
    skillDeltas: deltas,
    topCauses,
    topTraps,
    pattern: sessionPattern(attempts),
    nextFocus,
    achievements,
    highDifficultyAccuracy: hd.length ? hd.filter((a) => a.correct).length / hd.length : null,
  };
}

export function sessionPattern(attempts: Attempt[]): string {
  const wrong = attempts.filter((a) => !a.correct);
  if (attempts.length === 0) return '';
  if (wrong.length === 0) {
    const slow = attempts.filter((a) => a.plays > 1).length;
    return slow > 0
      ? `모두 정답이지만 ${slow}문제는 여러 번 들었습니다. 다음 세션에서 한 번 듣고 푸는 비율을 높입니다.`
      : '모든 문제를 정답 처리했습니다. 다음 세션의 난이도가 올라갑니다.';
  }
  // most frequent (cause, skill) pair
  const pairs = countBy(wrong.map((a) => `${a.mistakeCauses[0] ?? 'inference_error'}|${a.skill}`));
  const [cause, skill] = pairs[0].key.split('|') as [MistakeCause, SkillId];
  const f = PATTERN_TEXT[cause];
  const label = SKILLS[skill]?.labelKo ?? skill;
  if (pairs[0].count >= 2 && f) return f(label);
  const causes = countBy(wrong.map((a) => a.mistakeCauses[0]).filter(Boolean) as MistakeCause[]);
  if (causes.length && causes[0].count >= 2) return `가장 많은 오답 원인: ${causeLabel(causes[0].key)} (${causes[0].count}회).`;
  return `오답 ${wrong.length}개가 서로 다른 유형에 분산되어 있습니다. 뚜렷한 약점 패턴은 아직 없습니다.`;
}

export function trapLabel(t: DistractorType): string {
  return DISTRACTOR_LABEL[t];
}

// ---------------------------------------------------------------------------
// Achievements (performance gamification — no confetti)
// ---------------------------------------------------------------------------

export interface AchievementContext {
  attempts: Attempt[];
  before: Partial<Record<SkillId, number>>;
  after: Partial<Record<SkillId, number>>;
  streak: number;
  bestFirstListen: number | null;
  bestAccuracy: number | null;
}

export function detectAchievements(c: AchievementContext): string[] {
  const out: string[] = [];
  if (c.streak >= 2) out.push(`Training Streak ${c.streak}일`);
  const lc = c.attempts.filter((a) => a.firstListenCorrect !== null);
  if (lc.length >= 5) {
    const fl = lc.filter((a) => a.firstListenCorrect).length / lc.length;
    if (c.bestFirstListen === null || fl > c.bestFirstListen) out.push(`First Listen Personal Best ${(fl * 100).toFixed(0)}%`);
  }
  const fast = c.attempts.filter((a) => a.correct && a.credit >= 0.95).length;
  if (fast >= 8) out.push(`Fast & Correct ×${fast}`);
  for (const s of Object.keys(c.after) as SkillId[]) {
    const b = c.before[s];
    const a = c.after[s];
    if (b === undefined || a === undefined) continue;
    const crossed = [70, 75, 80, 85, 90, 95].find((th) => b < th && a >= th);
    if (crossed) out.push(`Skill Breakthrough: ${SKILLS[s].label} ${crossed}+`);
    if (b < 90 && a >= 90) out.push(`Weakness Eliminated: ${SKILLS[s].label}`);
  }
  const hd = c.attempts.filter((a) => a.difficulty >= 5);
  if (hd.length >= 3 && hd.every((a) => a.correct)) out.push('990 Challenge Clear');
  return [...new Set(out)];
}

// ---------------------------------------------------------------------------
// Readiness: objective indicators only (no predicted score)
// ---------------------------------------------------------------------------

export interface ReadinessIndicator {
  key: string;
  label: string;
  value: number | null; // 0..1 or seconds
  unit: '%' | 's';
  n: number;
  note: string;
}

export function readinessIndicators(states: Record<SkillId, SkillState>, attempts: Attempt[]): ReadinessIndicator[] {
  const avgMastery = (ids: SkillId[]) => {
    let w = 0;
    let s = 0;
    for (const id of ids) {
      const imp = SKILLS[id].importance;
      s += imp * masteryFromTheta(states[id].theta);
      w += imp;
    }
    return s / w / 100;
  };
  const recent = attempts.slice(-300);
  const exam = recent.filter((a) => a.mode === 'exam');
  const lc = recent.filter((a) => a.firstListenCorrect !== null);
  const hd = recent.filter((a) => a.difficulty >= 5);
  const rc = recent.filter((a) => a.part === 'P5');
  return [
    { key: 'lc_mastery', label: 'LC skill mastery (가중 평균)', value: avgMastery(LC_SKILLS), unit: '%', n: 0, note: '표준 난도 문항 예상 정답률' },
    { key: 'rc_mastery', label: 'RC skill mastery (가중 평균)', value: avgMastery(RC_SKILLS), unit: '%', n: 0, note: '표준 난도 문항 예상 정답률' },
    { key: 'mock', label: '최근 실전 모드 정답률', value: exam.length ? exam.filter((a) => a.correct).length / exam.length : null, unit: '%', n: exam.length, note: '실전 모드 기준' },
    { key: 'first_listen', label: '첫 청취 정답률', value: lc.length ? lc.filter((a) => a.firstListenCorrect).length / lc.length : null, unit: '%', n: lc.length, note: '1회 재생으로 맞힌 비율' },
    { key: 'high_diff', label: '난이도 5 정답률', value: hd.length ? hd.filter((a) => a.correct).length / hd.length : null, unit: '%', n: hd.length, note: '990 Challenge 문항' },
    { key: 'p5_time', label: 'Part 5 평균 풀이시간', value: rc.length ? rc.reduce((s, a) => s + a.responseMs, 0) / rc.length / 1000 : null, unit: 's', n: rc.length, note: '실전 권장 ≤ 20초' },
  ];
}
