/**
 * Core domain types for the TOEIC 990 Adaptive Trainer.
 *
 * Everything in src/domain and src/generation is pure TypeScript with no
 * React Native imports so that it can be unit-tested in Node and shared with
 * the backend (server/).
 */

export type Section = 'LC' | 'RC';

export type ListeningSkill =
  | 'short_gist'
  | 'extended_gist'
  | 'short_detail'
  | 'extended_detail'
  | 'speaker_intent'
  | 'implied_meaning'
  | 'next_action_prediction'
  | 'paraphrase_recognition'
  | 'negative_question'
  | 'indirect_response'
  | 'speaker_relationship'
  | 'location_context'
  | 'purpose_identification'
  | 'visual_information_linking';

export type ReadingSkill =
  | 'vocabulary'
  | 'grammar'
  | 'inference'
  | 'specific_information'
  | 'cross_sentence_connection'
  | 'paraphrase'
  | 'reference'
  | 'purpose'
  | 'text_structure'
  | 'multi_passage_synthesis'
  | 'time_pressure_accuracy';

export type SkillId = ListeningSkill | ReadingSkill;

/** Question formats. VOC = vocabulary drill formats outside the strict TOEIC parts. */
export type Part = 'P2' | 'P3' | 'P4' | 'P5' | 'P6' | 'P7' | 'VOC';

export type Difficulty = 1 | 2 | 3 | 4 | 5;

export type DistractorType =
  | 'keyword_overlap'
  | 'true_but_irrelevant'
  | 'wrong_person'
  | 'wrong_time'
  | 'opposite_meaning'
  | 'literal_interpretation'
  | 'reasonable_but_unstated'
  | 'grammar_surface_match'
  | 'similar_sound'
  | 'wrong_question_type'
  | 'wrong_form'
  | 'collocation_mismatch'
  | 'meaning_mismatch';

export type MistakeCause =
  | 'missed_detail'
  | 'missed_gist'
  | 'literal_interpretation'
  | 'missed_paraphrase'
  | 'speaker_intent_failure'
  | 'distractor_keyword_match'
  | 'grammar_rule_confusion'
  | 'vocabulary_gap'
  | 'time_pressure'
  | 'overthinking'
  | 'inference_error';

export type Situation =
  | 'office'
  | 'meeting'
  | 'conference'
  | 'travel'
  | 'airport'
  | 'hotel'
  | 'restaurant'
  | 'retail'
  | 'shipping'
  | 'manufacturing'
  | 'customer_service'
  | 'recruiting'
  | 'hr'
  | 'banking'
  | 'real_estate'
  | 'technology'
  | 'training'
  | 'marketing'
  | 'accounting'
  | 'contracts'
  | 'events'
  | 'maintenance';

export type SourceType = 'seed' | 'procedural' | 'ai';

export type TrainingMode = 'training' | 'exam';

/** 0 = 확신 없음, 1 = 애매함, 2 = 확신 */
export type ConfidenceLevel = 0 | 1 | 2;

export type Speaker = 'M' | 'W' | 'M2' | 'W2' | 'N';

export interface ScriptLine {
  speaker: Speaker;
  text: string;
  /** accent hint for TTS: 'us' | 'gb' | 'au' | 'ca' */
  accent?: Accent;
}

export type Accent = 'us' | 'gb' | 'au' | 'ca';

export interface Choice {
  text: string;
  /** undefined for the correct choice */
  distractorType?: DistractorType;
  /** Why this choice is wrong (or right) — shown in step-3 explanation. */
  rationale?: string;
}

export interface Explanation {
  /** 1-2 lines: why the answer is right. */
  short: string;
  /** Longer explanation, shown on "Why?" */
  detail: string;
}

/** A single answerable item. A Question (unit) holds one or more items. */
export interface QuestionItem {
  id: string;
  stem: string;
  choices: Choice[];
  answerIndex: number;
  skill: SkillId;
  subskill: string;
  secondarySkills?: SkillId[];
  difficulty: Difficulty;
  explanation: Explanation;
  /** Indices of script lines / passage sentences that hold the evidence. */
  evidenceLines?: number[];
  /** If the stem quotes a line (intent questions). */
  quotedLine?: string;
  /** Only shown in training mode (thinking-process drills). */
  trainingOnly?: boolean;
}

export interface Graphic {
  title: string;
  columns: string[];
  rows: string[][];
}

export interface Question {
  id: string;
  part: Part;
  /** Primary skill of the unit (the skill the scheduler requested). */
  skill: SkillId;
  subskill: string;
  difficulty: Difficulty;
  /** Title / instruction, e.g. "Conversation" or passage heading. */
  title?: string;
  /** Reading passage text (P6/P7) or a sentence (VOC). */
  passage?: string;
  /** Listening script. Hidden before answering in LC. */
  audioScript?: ScriptLine[];
  graphic?: Graphic;
  items: QuestionItem[];

  // ---- metadata -------------------------------------------------------
  grammarPoint?: string;
  vocabularyTargets: string[];
  situation: Situation;
  topic: string;
  /** e.g. "p5.prep.deadline_by" or "p3.goal:reschedule>comp:full>intent:alt>next:email" */
  questionStructure: string;
  /** trick / reasoning identifier used by duplicate detection (level 4/7). */
  reasoningPath: string;
  /** template id (level 3 structure similarity) */
  templateId: string;
  distractorTypes: DistractorType[];
  generationTimestamp: number;
  sourceType: SourceType;
  semanticFingerprint: string;
  qualityScore?: number;
  /** Seconds the unit is expected to take (audio + answering + review). */
  estimatedSeconds: number;
  /** Generator's own difficulty label before calibration. */
  generatorDifficulty?: Difficulty;
  /** Lexical material keys (word family, target word, filler set) for novelty. */
  lexKeys?: string[];
  /** Quality notes from the critic (kept for the developer dashboard). */
  qualityNotes?: string[];
}

// ---------------------------------------------------------------------------
// Skill model
// ---------------------------------------------------------------------------

export interface SkillHistoryPoint {
  /** epoch ms */
  t: number;
  mastery: number;
}

export interface SkillState {
  skill: SkillId;
  /** ability in logits. mastery = 100 * sigmoid(theta) */
  theta: number;
  /** uncertainty (std dev in logits) */
  sigma: number;
  seedScore: number;
  attemptCount: number;
  correctCount: number;
  /** last 20 outcomes, newest last (1 = correct) */
  recent: number[];
  /** exponentially weighted accuracy (alpha 0.15) */
  ewmaAccuracy: number;
  /** last 30 response times in ms */
  responseTimes: number[];
  /** weighted-by-difficulty sums for difficulty adjusted accuracy */
  daWeightedCorrect: number;
  daWeightTotal: number;
  firstAttemptCount: number;
  firstAttemptCorrect: number;
  /** LC: first listen correct counts */
  firstListenCount: number;
  firstListenCorrect: number;
  /** confident but wrong in the last window (misconception signal) */
  confidentWrong: number;
  lastPracticedAt: number | null;
  /** per-session snapshots of mastery */
  history: SkillHistoryPoint[];
}

export interface SkillView {
  skill: SkillId;
  label: string;
  section: Section;
  masteryScore: number;
  confidence: number;
  attemptCount: number;
  recentAccuracy: number | null;
  weightedAccuracy: number | null;
  medianResponseTime: number | null;
  difficultyAdjustedAccuracy: number | null;
  lastPracticedAt: number | null;
  trend: number;
  firstAttemptAccuracy: number | null;
  firstListenAccuracy: number | null;
}

// ---------------------------------------------------------------------------
// Sessions / attempts
// ---------------------------------------------------------------------------

export interface Attempt {
  id: string;
  sessionId: string;
  questionId: string;
  itemId: string;
  part: Part;
  skill: SkillId;
  subskill: string;
  difficulty: Difficulty;
  selectedIndex: number; // -1 = timed out / skipped
  correct: boolean;
  responseMs: number;
  plays: number;
  firstListenCorrect: boolean | null;
  confidence: ConfidenceLevel | null;
  answerChanges: number;
  chosenDistractorType: DistractorType | null;
  mistakeCauses: MistakeCause[];
  expectedP: number;
  credit: number;
  mode: TrainingMode;
  at: number;
  isFirstExposure: boolean;
  timedOut: boolean;
  situation: Situation;
  vocabularyTargets: string[];
}

export interface QuestionExposure {
  questionId: string;
  sessionId: string;
  shownAt: number;
  fingerprint: string;
  templateId: string;
  reasoningPath: string;
  situation: Situation;
  topic: string;
  part: Part;
  answerPositions: number[];
}

export interface BlueprintSlot {
  id: string;
  part: Part;
  skill: SkillId;
  subskill?: string;
  /** targeted difficulty; may be revised by in-session adaptation */
  difficulty: Difficulty;
  group: DisplayGroup;
  estimatedSeconds: number;
  /** focus hints: e.g. target vocab words, grammar tricks, mistake causes */
  vocabTargets?: string[];
  focusCause?: MistakeCause;
  /** For multi-item sets (P3/P4/P7): skills of the individual items. */
  itemSkills?: SkillId[];
  isChallenge?: boolean;
  reason: string;
}

export type DisplayGroup = 'intent' | 'gist' | 'vocabulary' | 'grammar' | 'listening' | 'reading' | 'maintenance' | 'challenge';

export interface SkillAllocation {
  skill: SkillId;
  priority: number;
  targetSeconds: number;
  reasons: string[];
  targetDifficulty: Difficulty;
}

export interface TrainingBlueprint {
  id: string;
  createdAt: number;
  mode: TrainingMode;
  budgetSeconds: number;
  estimatedSeconds: number;
  slots: BlueprintSlot[];
  allocations: SkillAllocation[];
  groupCounts: Partial<Record<DisplayGroup, number>>;
  bottlenecks: SkillId[];
  decisions: string[];
}

export interface TrainingSession {
  id: string;
  mode: TrainingMode;
  startedAt: number;
  endedAt: number | null;
  blueprint: TrainingBlueprint;
  questionIds: string[];
  attemptIds: string[];
  /** mastery snapshot before session */
  masteryBefore: Partial<Record<SkillId, number>>;
  masteryAfter: Partial<Record<SkillId, number>>;
  summary?: SessionSummary;
}

export interface SessionSummary {
  accuracy: number;
  items: number;
  correct: number;
  durationSec: number;
  firstListenAccuracy: number | null;
  avgResponseSec: number;
  biggestGain: { skill: SkillId; before: number; after: number } | null;
  skillDeltas: { skill: SkillId; before: number; after: number }[];
  topCauses: { cause: MistakeCause; count: number }[];
  topTraps: { type: DistractorType; count: number }[];
  pattern: string;
  nextFocus: string[];
  achievements: string[];
  highDifficultyAccuracy: number | null;
}

export interface MistakePatternStat {
  key: string; // cause or distractor type
  kind: 'cause' | 'distractor';
  count: number;
  lastAt: number;
}

export interface VocabularyItem {
  word: string;
  meaning: string;
  partOfSpeech: string;
  context: string;
  collocations: string[];
  difficulty: Difficulty;
  encounterCount: number;
  correctCount: number;
  slowCount: number;
  lastSeen: number;
  mastery: number; // 0..100
  /** formats in which this word was already practiced */
  formatsSeen: string[];
  addedReason: 'wrong' | 'slow' | 'unsure' | 'seed';
}

export interface GenerationJob {
  id: string;
  at: number;
  slotSkill: SkillId;
  part: Part;
  source: SourceType;
  attempts: number;
  accepted: boolean;
  rejectReasons: string[];
}

export interface QualityReview {
  score: number;
  passed: boolean;
  issues: string[];
  checks: Record<string, boolean>;
}

export interface UserSettings {
  dailyMinutes: number;
  difficultyBias: -1 | 0 | 1;
  speechRate: number;
  mode: TrainingMode;
  ttsProvider: 'device' | 'remote';
  autoPlay: boolean;
  askConfidence: boolean;
  theme: 'system' | 'light' | 'dark';
  apiBaseUrl: string;
  developerMode: boolean;
}

export interface UserProfile {
  id: string;
  createdAt: number;
  targetScore: number;
  seedScores: Record<string, number>;
  settings: UserSettings;
  streak: { current: number; best: number; lastDay: string | null };
}

export interface AdaptiveDecisionLog {
  at: number;
  kind: 'plan' | 'in_session' | 'generation';
  message: string;
}
