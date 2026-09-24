/**
 * Training engine: the learning loop.
 *
 *  performance -> skill model -> weakness detection -> today's blueprint
 *  -> question generation (+QC) -> training -> error analysis -> skill update
 *
 * Pure TypeScript (no React Native) so the same engine runs in the app, in
 * tests, and in the offline simulator.
 */
import { adaptOnResult, adaptSlot, AdaptState, createAdaptState } from '../domain/adaptation';
import { diagnose, inferMistakeCauses } from '../domain/errorAnalysis';
import { detectAchievements, summarizeSession } from '../domain/insights';
import { buildBlueprint } from '../domain/planner';
import { createRng, dayKey, DAY_MS, Rng, uid } from '../domain/rng';
import { applyInactivity, masteryFromTheta, performanceCredit, seedSkillStates, snapshot, updateFamilyOffset, updateSkill } from '../domain/skillModel';
import { SKILL_IDS, SKILLS } from '../domain/skills';
import type {
  AdaptiveDecisionLog,
  Attempt,
  ConfidenceLevel,
  GenerationJob,
  MistakeCause,
  Part,
  Question,
  QuestionItem,
  SkillId,
  SkillState,
  TrainingBlueprint,
  TrainingMode,
  TrainingSession,
  UserProfile,
  UserSettings,
  VocabularyItem,
} from '../domain/types';
import { isDue, newVocabItem, nextVocabFormat, recordVocabEncounter, weakVocabQueue } from '../domain/vocabulary';
import { VOCAB_BY_WORD } from '../generation/content/vocabBank';
import { DuplicateDetector, ExposureRecord } from '../generation/duplicate';
import { NoveltyContext } from '../generation/genTypes';
import { buildNovelty, emptyStats, materialize, PipelineStats } from '../generation/pipeline';

export const DEFAULT_SETTINGS: UserSettings = {
  dailyMinutes: 30,
  difficultyBias: 0,
  speechRate: 1,
  mode: 'training',
  ttsProvider: 'device',
  autoPlay: true,
  askConfidence: true,
  theme: 'system',
  apiBaseUrl: '',
  developerMode: false,
};

export interface AppData {
  profile: UserProfile;
  skills: Record<SkillId, SkillState>;
  questions: Record<string, Question>;
  pool: Question[];
  exposures: ExposureRecord[];
  /** exact hashes of every question ever shown (never re-served) */
  exactHashes: string[];
  attempts: Attempt[];
  sessions: TrainingSession[];
  vocab: Record<string, VocabularyItem>;
  familyOffsets: Record<string, number>;
  decisions: AdaptiveDecisionLog[];
  genStats: PipelineStats;
  jobs: GenerationJob[];
}

/** Persistence hooks — the app wires these to SQLite; tests leave them empty. */
export interface PersistSink {
  question?(q: Question): void;
  exposure?(r: ExposureRecord): void;
  attempt?(a: Attempt): void;
  skills?(s: Record<SkillId, SkillState>): void;
  vocab?(v: VocabularyItem): void;
  session?(s: TrainingSession): void;
  job?(j: GenerationJob): void;
  decision?(d: AdaptiveDecisionLog): void;
  profile?(p: UserProfile): void;
  family?(key: string, offset: number): void;
  stats?(s: PipelineStats): void;
  poolRemove?(id: string): void;
}

export function createInitialData(now = Date.now(), ets?: Record<string, number>): AppData {
  const profile: UserProfile = {
    id: uid('user'),
    createdAt: now,
    targetScore: 990,
    seedScores: ets ?? {},
    settings: { ...DEFAULT_SETTINGS },
    streak: { current: 0, best: 0, lastDay: null },
  };
  return {
    profile,
    skills: seedSkillStates(ets, now),
    questions: {},
    pool: [],
    exposures: [],
    exactHashes: [],
    attempts: [],
    sessions: [],
    vocab: {},
    familyOffsets: {},
    decisions: [],
    genStats: emptyStats(),
    jobs: [],
  };
}

export const LISTENING_PARTS: Part[] = ['P2', 'P3', 'P4'];
export const isListeningPart = (p: Part) => LISTENING_PARTS.includes(p);

export function typicalMs(q: Question, item: QuestionItem): number {
  switch (q.part) {
    case 'P2':
      return 9000;
    case 'P3':
    case 'P4':
      return item.trainingOnly ? 25000 : 14000;
    case 'P5':
      return 20000;
    case 'VOC':
      return item.subskill === 'vocab_listening' ? 15000 : 17000;
    case 'P6':
    case 'P7':
      return 35000;
  }
}

export function familyKey(q: Question, item: QuestionItem): string {
  return `${q.part}:${item.subskill}:${q.reasoningPath.split('.').slice(0, 3).join('.')}`;
}

// ---------------------------------------------------------------------------
// Planning
// ---------------------------------------------------------------------------

export function recentAttempts(data: AppData, now: number, days = 14): Attempt[] {
  return data.attempts.filter((a) => now - a.at <= days * DAY_MS);
}

export function topCausesBySkill(attempts: Attempt[]): Partial<Record<SkillId, MistakeCause>> {
  const m = new Map<SkillId, Map<MistakeCause, number>>();
  for (const a of attempts) {
    if (a.correct || !a.mistakeCauses[0]) continue;
    const mm = m.get(a.skill) ?? new Map();
    mm.set(a.mistakeCauses[0], (mm.get(a.mistakeCauses[0]) ?? 0) + 1);
    m.set(a.skill, mm);
  }
  const out: Partial<Record<SkillId, MistakeCause>> = {};
  for (const [s, mm] of m) {
    const best = [...mm.entries()].sort((a, b) => b[1] - a[1])[0];
    if (best && best[1] >= 2) out[s] = best[0];
  }
  return out;
}

export function planToday(data: AppData, now: number, mode: TrainingMode = data.profile.settings.mode, seed?: number): TrainingBlueprint {
  const states = {} as Record<SkillId, SkillState>;
  for (const s of SKILL_IDS) states[s] = applyInactivity(data.skills[s], now);
  const recent = recentAttempts(data, now);
  const weak = weakVocabQueue(Object.values(data.vocab), now).filter((v) => isDue(v, now) && VOCAB_BY_WORD[v.word]);
  return buildBlueprint({
    states,
    recentAttempts: recent,
    budgetSeconds: data.profile.settings.dailyMinutes * 60,
    difficultyBias: data.profile.settings.difficultyBias,
    now,
    mode,
    weakVocab: weak.map((w) => w.word),
    topCauses: topCausesBySkill(recent),
    seed,
  });
}

// ---------------------------------------------------------------------------
// Session runtime
// ---------------------------------------------------------------------------

export interface SessionRuntime {
  session: TrainingSession;
  index: number;
  adapt: AdaptState;
  detector: DuplicateDetector;
  novelty: NoveltyContext;
  rng: Rng;
  /** slotId -> materialized question (look-ahead cache => no waiting) */
  cache: Record<string, Question>;
  attempts: Attempt[];
  skipped: string[];
}

export function startSession(data: AppData, blueprint: TrainingBlueprint, now: number, sink: PersistSink = {}, seed?: number): SessionRuntime {
  const masteryBefore: Partial<Record<SkillId, number>> = {};
  for (const s of SKILL_IDS) masteryBefore[s] = masteryFromTheta(data.skills[s].theta);
  const session: TrainingSession = {
    id: uid('sess'),
    mode: blueprint.mode,
    startedAt: now,
    endedAt: null,
    blueprint,
    questionIds: [],
    attemptIds: [],
    masteryBefore,
    masteryAfter: {},
  };
  const detector = new DuplicateDetector(data.exposures, now, [...data.exactHashes, ...data.exposures.map((e) => e.exact)]);
  const rt: SessionRuntime = {
    session,
    index: 0,
    adapt: createAdaptState(),
    detector,
    novelty: buildNovelty(detector.records),
    rng: createRng(seed ?? now),
    cache: {},
    attempts: [],
    skipped: [],
  };
  logDecision(data, sink, now, 'plan', `Blueprint ${blueprint.slots.length} slots, ~${Math.round(blueprint.estimatedSeconds / 60)}min; bottlenecks: ${blueprint.bottlenecks.join(', ')}`);
  for (const d of blueprint.decisions) logDecision(data, sink, now, 'plan', d);
  sink.session?.(session);
  prefetch(data, rt, now, sink, 3);
  return rt;
}

function logDecision(data: AppData, sink: PersistSink, at: number, kind: AdaptiveDecisionLog['kind'], message: string) {
  const d = { at, kind, message };
  data.decisions.push(d);
  if (data.decisions.length > 500) data.decisions.splice(0, data.decisions.length - 500);
  sink.decision?.(d);
}

/** Materialize up to `ahead` upcoming slots (cheap, synchronous, offline). */
export function prefetch(data: AppData, rt: SessionRuntime, now: number, sink: PersistSink = {}, ahead = 2) {
  const slots = rt.session.blueprint.slots;
  for (let i = rt.index; i < Math.min(slots.length, rt.index + ahead); i++) {
    const slot = slots[i];
    if (rt.cache[slot.id] || rt.skipped.includes(slot.id)) continue;
    const adapted = adaptSlot(slot, rt.adapt);
    if (adapted.difficulty !== slot.difficulty) logDecision(data, sink, now, 'in_session', `${slot.skill}: difficulty ${slot.difficulty}→${adapted.difficulty}${adapted.focusCause ? ` (focus ${adapted.focusCause})` : ''}`);
    const vocabTargets = adapted.vocabTargets;
    const withFormat = vocabTargets?.length ? { ...adapted, subskill: nextVocabFormat(data.vocab[vocabTargets[0]]) } : adapted;
    const res = materialize({ slot: withFormat, mode: rt.session.mode, now, rng: rt.rng, detector: rt.detector, novelty: rt.novelty, pool: data.pool, stats: data.genStats });
    data.jobs.push(res.job);
    if (data.jobs.length > 300) data.jobs.splice(0, data.jobs.length - 300);
    sink.job?.(res.job);
    for (const d of res.decisions) logDecision(data, sink, now, 'generation', d);
    if (res.question) {
      const q = res.question;
      rt.cache[slot.id] = q;
      data.questions[q.id] = q;
      sink.question?.(q);
      if (q.sourceType !== 'procedural') sink.poolRemove?.(q.id);
      const rec = rt.detector.records[rt.detector.records.length - 1];
      data.exposures.push(rec);
      data.exactHashes.push(rec.exact);
      sink.exposure?.(rec);
      rt.session.questionIds.push(q.id);
    } else {
      rt.skipped.push(slot.id);
      logDecision(data, sink, now, 'generation', `slot ${slot.part}/${slot.skill} skipped: no valid novel question`);
    }
  }
  sink.stats?.(data.genStats);
}

export function currentQuestion(data: AppData, rt: SessionRuntime, now: number, sink: PersistSink = {}): { question: Question; slotIndex: number } | null {
  const slots = rt.session.blueprint.slots;
  while (rt.index < slots.length) {
    const slot = slots[rt.index];
    if (!rt.cache[slot.id] && !rt.skipped.includes(slot.id)) prefetch(data, rt, now, sink, 1);
    const q = rt.cache[slot.id];
    if (q) return { question: q, slotIndex: rt.index };
    rt.index++;
  }
  return null;
}

export interface AnswerInput {
  question: Question;
  item: QuestionItem;
  selectedIndex: number;
  responseMs: number;
  plays: number;
  confidence: ConfidenceLevel | null;
  answerChanges: number;
  firstChoiceWasCorrect: boolean;
  timedOut?: boolean;
}

export interface AnswerFeedback {
  attempt: Attempt;
  correct: boolean;
  credit: number;
  causes: MistakeCause[];
  diagnosis: string;
  masteryBefore: number;
  masteryAfter: number;
  notes: string[];
}

export function submitAnswer(data: AppData, rt: SessionRuntime | null, a: AnswerInput, now: number, sink: PersistSink = {}): AnswerFeedback {
  const { question: q, item } = a;
  const correct = !a.timedOut && a.selectedIndex === item.answerIndex;
  const listening = isListeningPart(q.part) || (q.part === 'VOC' && item.subskill === 'vocab_listening');
  const tMs = typicalMs(q, item);
  const credit = performanceCredit({
    correct,
    isListening: listening,
    plays: a.plays,
    responseMs: a.responseMs,
    typicalMs: tMs,
    confidence: a.confidence,
    answerChanges: a.answerChanges,
    timedOut: a.timedOut,
  });
  const chosen = a.selectedIndex >= 0 ? item.choices[a.selectedIndex] : undefined;
  const signal = {
    part: q.part,
    skill: item.skill,
    correct,
    chosenDistractor: chosen?.distractorType ?? null,
    responseMs: a.responseMs,
    typicalMs: tMs,
    plays: a.plays,
    confidence: a.confidence,
    answerChanges: a.answerChanges,
    firstChoiceWasCorrect: a.firstChoiceWasCorrect,
    timedOut: !!a.timedOut,
  };
  const causes = inferMistakeCauses(signal);
  const fam = familyKey(q, item);
  const famOffset = data.familyOffsets[fam] ?? 0;
  const isFirstExposure = !data.attempts.some((x) => x.itemId === item.id);

  const before = masteryFromTheta(data.skills[item.skill].theta);
  const up = updateSkill(data.skills[item.skill], {
    difficulty: item.difficulty,
    familyOffset: famOffset,
    credit: credit.credit,
    correct,
    responseMs: a.responseMs,
    plays: a.plays,
    isListening: listening,
    confidence: a.confidence,
    isFirstExposure,
    misconception: credit.misconception,
    at: now,
  });
  data.skills[item.skill] = up.state;
  // secondary skills learn a little from the same evidence
  for (const s2 of item.secondarySkills ?? []) {
    if (s2 === item.skill) continue;
    data.skills[s2] = updateSkill(data.skills[s2], {
      difficulty: item.difficulty,
      familyOffset: famOffset,
      credit: credit.credit,
      correct,
      responseMs: a.responseMs,
      plays: a.plays,
      isListening: listening,
      confidence: a.confidence,
      isFirstExposure,
      misconception: false,
      at: now,
      weight: 0.35,
    }).state;
  }
  // exam-mode time pressure is its own skill
  if (rt?.session.mode === 'exam' && !listening) {
    data.skills.time_pressure_accuracy = updateSkill(data.skills.time_pressure_accuracy, {
      difficulty: item.difficulty,
      credit: credit.credit,
      correct,
      responseMs: a.responseMs,
      plays: 1,
      isListening: false,
      confidence: null,
      isFirstExposure,
      misconception: false,
      at: now,
      weight: 0.5,
    }).state;
  }
  data.familyOffsets[fam] = updateFamilyOffset(famOffset, up.expected, correct);
  sink.family?.(fam, data.familyOffsets[fam]);
  const after = masteryFromTheta(data.skills[item.skill].theta);

  const attempt: Attempt = {
    id: uid('att'),
    sessionId: rt?.session.id ?? 'review',
    questionId: q.id,
    itemId: item.id,
    part: q.part,
    skill: item.skill,
    subskill: item.subskill,
    difficulty: item.difficulty,
    selectedIndex: a.selectedIndex,
    correct,
    responseMs: a.responseMs,
    plays: a.plays,
    firstListenCorrect: listening ? correct && a.plays <= 1 : null,
    confidence: a.confidence,
    answerChanges: a.answerChanges,
    chosenDistractorType: correct ? null : chosen?.distractorType ?? null,
    mistakeCauses: causes,
    expectedP: up.expected,
    credit: credit.credit,
    mode: rt?.session.mode ?? 'training',
    at: now,
    isFirstExposure,
    timedOut: !!a.timedOut,
    situation: q.situation,
    vocabularyTargets: q.vocabularyTargets,
  };
  data.attempts.push(attempt);
  sink.attempt?.(attempt);
  sink.skills?.(data.skills);
  if (rt) {
    rt.attempts.push(attempt);
    rt.session.attemptIds.push(attempt.id);
    rt.adapt = adaptOnResult(rt.adapt, {
      skill: item.skill,
      correct,
      credit: credit.credit,
      fast: a.responseMs < tMs,
      difficulty: item.difficulty,
      causes,
    });
  }

  // vocabulary weakness tracking
  const slow = a.responseMs > tMs * 1.6;
  const unsure = a.confidence === 0;
  for (const w of q.vocabularyTargets) {
    const entry = VOCAB_BY_WORD[w];
    // only track words the engine can re-teach in new contexts/formats
    if (!entry) continue;
    const existing = data.vocab[w];
    const format = item.subskill.startsWith('vocab_') ? item.subskill.replace('vocab_', '') : 'context';
    if (existing) {
      data.vocab[w] = recordVocabEncounter(existing, { correct, slow, unsure, format }, now);
      sink.vocab?.(data.vocab[w]);
    } else if (!correct || slow || unsure) {
      const context = (q.passage ?? item.stem).slice(0, 200);
      const created = newVocabItem(w, entry.ko, entry.pos, context, entry.colloc, entry.level, !correct ? 'wrong' : unsure ? 'unsure' : 'slow', now);
      data.vocab[w] = recordVocabEncounter(created, { correct, slow, unsure, format }, now);
      sink.vocab?.(data.vocab[w]);
    }
  }

  return {
    attempt,
    correct,
    credit: credit.credit,
    causes,
    diagnosis: diagnose(signal, causes),
    masteryBefore: before,
    masteryAfter: after,
    notes: credit.notes,
  };
}

/** Move to the next slot once every item of the current unit is answered. */
export function advance(data: AppData, rt: SessionRuntime, now: number, sink: PersistSink = {}) {
  rt.index++;
  prefetch(data, rt, now, sink, 2);
}

export function finishSession(data: AppData, rt: SessionRuntime, now: number, sink: PersistSink = {}): TrainingSession {
  const s = rt.session;
  s.endedAt = now;
  for (const id of SKILL_IDS) {
    data.skills[id] = snapshot(data.skills[id], now);
    s.masteryAfter[id] = masteryFromTheta(data.skills[id].theta);
  }
  sink.skills?.(data.skills);
  // streak
  const today = dayKey(now);
  const st = data.profile.streak;
  if (rt.attempts.length >= 5 && st.lastDay !== today) {
    const yesterday = dayKey(now - DAY_MS);
    st.current = st.lastDay === yesterday ? st.current + 1 : 1;
    st.best = Math.max(st.best, st.current);
    st.lastDay = today;
    sink.profile?.(data.profile);
  }
  const prevSessions = data.sessions.filter((x) => x.summary);
  const bestFL = prevSessions.reduce<number | null>((m, x) => (x.summary?.firstListenAccuracy != null ? Math.max(m ?? 0, x.summary.firstListenAccuracy) : m), null);
  const achievements = detectAchievements({
    attempts: rt.attempts,
    before: s.masteryBefore,
    after: s.masteryAfter,
    streak: st.current,
    bestFirstListen: bestFL,
    bestAccuracy: null,
  });
  // what the next session will emphasise (preview the planner with the new state)
  const preview = planToday(data, now + DAY_MS, 'training', now);
  const nextFocus = preview.allocations
    .slice()
    .sort((a, b) => b.targetSeconds - a.targetSeconds)
    .slice(0, 2)
    .map((a) => SKILLS[a.skill].label);
  s.summary = summarizeSession(rt.attempts, s.masteryBefore, s.masteryAfter, s.startedAt, now, nextFocus, achievements);
  data.sessions.push(s);
  sink.session?.(s);
  logDecision(data, sink, now, 'plan', `Session done: ${(s.summary.accuracy * 100).toFixed(0)}% (${s.summary.items} items). Next focus: ${nextFocus.join(' + ')}`);
  return s;
}

/**
 * Sessions interrupted by closing the app: their answers are already saved and
 * counted in the skill model; give them an end time and a summary so they show
 * up in History and count toward the streak.
 */
export function closeOrphanSessions(data: AppData, now: number, sink: PersistSink = {}): number {
  let closed = 0;
  for (const s of data.sessions) {
    if (s.endedAt) continue;
    const atts = data.attempts.filter((a) => a.sessionId === s.id);
    if (!atts.length) continue;
    const endedAt = atts[atts.length - 1].at;
    const after: Partial<Record<SkillId, number>> = {};
    for (const id of SKILL_IDS) after[id] = masteryFromTheta(data.skills[id].theta);
    s.endedAt = endedAt;
    s.masteryAfter = after;
    s.summary = summarizeSession(atts, s.masteryBefore, after, s.startedAt, endedAt, [], ['중단된 세션 (자동 저장)']);
    const day = dayKey(endedAt);
    const st = data.profile.streak;
    if (atts.length >= 5 && st.lastDay !== day && (!st.lastDay || st.lastDay < day)) {
      st.current = st.lastDay === dayKey(endedAt - DAY_MS) ? st.current + 1 : 1;
      st.best = Math.max(st.best, st.current);
      st.lastDay = day;
      sink.profile?.(data.profile);
    }
    sink.session?.(s);
    closed++;
  }
  return closed;
}

/** Items of a question that should be asked in the given mode. */
export function itemsForMode(q: Question, mode: TrainingMode): QuestionItem[] {
  return mode === 'exam' ? q.items.filter((i) => !i.trainingOnly) : q.items;
}

/** Wrong answers available for explicit review mode (the only place questions are re-shown). */
export function reviewQueue(data: AppData, limit = 30): { question: Question; item: QuestionItem; attempt: Attempt }[] {
  const out: { question: Question; item: QuestionItem; attempt: Attempt }[] = [];
  const seen = new Set<string>();
  for (let i = data.attempts.length - 1; i >= 0 && out.length < limit; i--) {
    const a = data.attempts[i];
    if (a.correct && a.confidence !== 0) continue;
    if (seen.has(a.itemId)) continue;
    seen.add(a.itemId);
    const q = data.questions[a.questionId];
    const item = q?.items.find((it) => it.id === a.itemId);
    if (q && item) out.push({ question: q, item, attempt: a });
  }
  return out;
}
