import type { DisplayGroup, Part, Section, SkillId } from './types';

export interface SkillMeta {
  id: SkillId;
  section: Section;
  label: string; // short english label for dashboards
  labelKo: string;
  /**
   * Approximate share of TOEIC score that depends on this skill (0..1, relative).
   * Used by the scheduler as "exam importance". Tuned from the structure of
   * the test (e.g. Part 5/6 vocabulary appears in ~25+ items, Part 3/4 intent
   * questions in ~6-10 items but they are the high-loss items at 900+).
   */
  importance: number;
  /** display group when the skill is a *focus* skill */
  group: DisplayGroup;
  /** Formats able to train this skill, best first. */
  formats: Part[];
  /** Typical seconds per item in training mode (answer + review). */
  itemSeconds: number;
}

export const SKILLS: Record<SkillId, SkillMeta> = {
  // ---------------- Listening ----------------
  short_gist: { id: 'short_gist', section: 'LC', label: 'Short Gist', labelKo: '짧은 듣기 요지', importance: 0.6, group: 'listening', formats: ['P2'], itemSeconds: 35 },
  extended_gist: { id: 'extended_gist', section: 'LC', label: 'Extended Gist', labelKo: '긴 듣기 요지', importance: 0.95, group: 'gist', formats: ['P3', 'P4'], itemSeconds: 55 },
  short_detail: { id: 'short_detail', section: 'LC', label: 'Short Detail', labelKo: '짧은 듣기 세부', importance: 0.5, group: 'maintenance', formats: ['P2'], itemSeconds: 30 },
  extended_detail: { id: 'extended_detail', section: 'LC', label: 'Extended Detail', labelKo: '긴 듣기 세부', importance: 0.7, group: 'maintenance', formats: ['P3', 'P4'], itemSeconds: 45 },
  speaker_intent: { id: 'speaker_intent', section: 'LC', label: 'Speaker Intent', labelKo: '화자 의도', importance: 0.9, group: 'intent', formats: ['P3', 'P4'], itemSeconds: 55 },
  implied_meaning: { id: 'implied_meaning', section: 'LC', label: 'Implied Meaning', labelKo: '함축 의미', importance: 0.8, group: 'intent', formats: ['P3', 'P4', 'P2'], itemSeconds: 50 },
  next_action_prediction: { id: 'next_action_prediction', section: 'LC', label: 'Next Action', labelKo: '다음 행동 예측', importance: 0.6, group: 'intent', formats: ['P3', 'P4'], itemSeconds: 45 },
  paraphrase_recognition: { id: 'paraphrase_recognition', section: 'LC', label: 'LC Paraphrase', labelKo: '듣기 패러프레이즈', importance: 0.6, group: 'listening', formats: ['P3', 'P4'], itemSeconds: 45 },
  negative_question: { id: 'negative_question', section: 'LC', label: 'Negative Q', labelKo: '부정 의문문', importance: 0.35, group: 'listening', formats: ['P2'], itemSeconds: 30 },
  indirect_response: { id: 'indirect_response', section: 'LC', label: 'Indirect Response', labelKo: '간접 응답', importance: 0.75, group: 'intent', formats: ['P2'], itemSeconds: 35 },
  speaker_relationship: { id: 'speaker_relationship', section: 'LC', label: 'Speaker Role', labelKo: '화자 관계/직업', importance: 0.35, group: 'gist', formats: ['P3'], itemSeconds: 45 },
  location_context: { id: 'location_context', section: 'LC', label: 'Location', labelKo: '장소 파악', importance: 0.35, group: 'gist', formats: ['P3', 'P4'], itemSeconds: 45 },
  purpose_identification: { id: 'purpose_identification', section: 'LC', label: 'LC Purpose', labelKo: '발화 목적', importance: 0.85, group: 'gist', formats: ['P4', 'P3'], itemSeconds: 55 },
  visual_information_linking: { id: 'visual_information_linking', section: 'LC', label: 'Graphic Link', labelKo: '시각자료 연계', importance: 0.35, group: 'maintenance', formats: [], itemSeconds: 50 },

  // ---------------- Reading ----------------
  vocabulary: { id: 'vocabulary', section: 'RC', label: 'Vocabulary', labelKo: '어휘', importance: 1.45, group: 'vocabulary', formats: ['VOC', 'P5'], itemSeconds: 30 },
  grammar: { id: 'grammar', section: 'RC', label: 'Grammar', labelKo: '문법', importance: 1.5, group: 'grammar', formats: ['P5'], itemSeconds: 30 },
  inference: { id: 'inference', section: 'RC', label: 'Inference', labelKo: '독해 추론', importance: 0.7, group: 'maintenance', formats: ['P7'], itemSeconds: 60 },
  specific_information: { id: 'specific_information', section: 'RC', label: 'Specific Info', labelKo: '세부 정보', importance: 0.7, group: 'maintenance', formats: ['P7'], itemSeconds: 50 },
  cross_sentence_connection: { id: 'cross_sentence_connection', section: 'RC', label: 'Cross-Sentence', labelKo: '문장 연결', importance: 0.6, group: 'maintenance', formats: ['P6', 'P7'], itemSeconds: 55 },
  paraphrase: { id: 'paraphrase', section: 'RC', label: 'RC Paraphrase', labelKo: '독해 패러프레이즈', importance: 0.55, group: 'reading', formats: ['VOC', 'P7'], itemSeconds: 40 },
  reference: { id: 'reference', section: 'RC', label: 'Reference', labelKo: '지시어', importance: 0.3, group: 'maintenance', formats: ['P7'], itemSeconds: 45 },
  purpose: { id: 'purpose', section: 'RC', label: 'RC Purpose', labelKo: '글의 목적', importance: 0.5, group: 'maintenance', formats: ['P7'], itemSeconds: 50 },
  text_structure: { id: 'text_structure', section: 'RC', label: 'Text Structure', labelKo: '글의 구조', importance: 0.35, group: 'maintenance', formats: ['P6'], itemSeconds: 55 },
  multi_passage_synthesis: { id: 'multi_passage_synthesis', section: 'RC', label: 'Multi-Passage', labelKo: '다중 지문', importance: 0.5, group: 'maintenance', formats: ['P7'], itemSeconds: 70 },
  time_pressure_accuracy: { id: 'time_pressure_accuracy', section: 'RC', label: 'Time Pressure', labelKo: '시간 압박 정확도', importance: 0.5, group: 'maintenance', formats: ['P5'], itemSeconds: 25 },
};

export const SKILL_IDS = Object.keys(SKILLS) as SkillId[];
export const LC_SKILLS = SKILL_IDS.filter((s) => SKILLS[s].section === 'LC');
export const RC_SKILLS = SKILL_IDS.filter((s) => SKILLS[s].section === 'RC');

/** ETS score-report categories (what the user actually measured). */
export const ETS_CATEGORIES = {
  short_spoken_gist: 80,
  extended_spoken_gist: 68,
  short_spoken_detail: 100,
  extended_spoken_detail: 94,
  speaker_purpose_or_implied_meaning: 65,
  written_inference: 96,
  written_specific_information: 95,
  cross_sentence_connection: 92,
  written_vocabulary: 79,
  written_grammar: 85,
} as const;

export type EtsCategory = keyof typeof ETS_CATEGORIES;

/**
 * Seed mapping: fine-grained skill <- ETS categories.
 * `direct` skills are measured directly (lower initial uncertainty);
 * derived skills are averages of related categories with higher uncertainty.
 */
export const SEED_MAP: Record<SkillId, { from: EtsCategory[]; sigma: number; note: string }> = {
  short_gist: { from: ['short_spoken_gist'], sigma: 0.6, note: 'ETS short spoken gist' },
  extended_gist: { from: ['extended_spoken_gist'], sigma: 0.6, note: 'ETS extended spoken gist' },
  short_detail: { from: ['short_spoken_detail'], sigma: 0.6, note: 'ETS short spoken detail' },
  extended_detail: { from: ['extended_spoken_detail'], sigma: 0.6, note: 'ETS extended spoken detail' },
  speaker_intent: { from: ['speaker_purpose_or_implied_meaning'], sigma: 0.6, note: 'ETS purpose/implied meaning' },
  implied_meaning: { from: ['speaker_purpose_or_implied_meaning'], sigma: 0.6, note: 'ETS purpose/implied meaning' },
  next_action_prediction: { from: ['extended_spoken_gist', 'speaker_purpose_or_implied_meaning'], sigma: 0.8, note: 'gist + implied avg' },
  paraphrase_recognition: { from: ['extended_spoken_detail', 'short_spoken_gist'], sigma: 0.8, note: 'detail + gist avg' },
  negative_question: { from: ['short_spoken_gist', 'short_spoken_detail'], sigma: 0.8, note: 'short gist + detail avg' },
  indirect_response: { from: ['short_spoken_gist', 'speaker_purpose_or_implied_meaning'], sigma: 0.8, note: 'short gist + implied avg' },
  speaker_relationship: { from: ['extended_spoken_gist', 'short_spoken_gist'], sigma: 0.8, note: 'gist avg' },
  location_context: { from: ['extended_spoken_gist', 'short_spoken_gist'], sigma: 0.8, note: 'gist avg' },
  purpose_identification: { from: ['extended_spoken_gist', 'speaker_purpose_or_implied_meaning'], sigma: 0.7, note: 'gist + purpose avg' },
  visual_information_linking: { from: ['extended_spoken_detail'], sigma: 0.8, note: 'extended detail' },
  vocabulary: { from: ['written_vocabulary'], sigma: 0.6, note: 'ETS vocabulary' },
  grammar: { from: ['written_grammar'], sigma: 0.6, note: 'ETS grammar' },
  inference: { from: ['written_inference'], sigma: 0.6, note: 'ETS inference' },
  specific_information: { from: ['written_specific_information'], sigma: 0.6, note: 'ETS specific info' },
  cross_sentence_connection: { from: ['cross_sentence_connection'], sigma: 0.6, note: 'ETS cross-sentence' },
  paraphrase: { from: ['written_vocabulary', 'written_specific_information'], sigma: 0.8, note: 'vocab + specific avg' },
  reference: { from: ['cross_sentence_connection'], sigma: 0.8, note: 'cross-sentence' },
  purpose: { from: ['written_inference', 'written_specific_information'], sigma: 0.8, note: 'inference + specific avg' },
  text_structure: { from: ['cross_sentence_connection'], sigma: 0.8, note: 'cross-sentence' },
  multi_passage_synthesis: { from: ['written_inference', 'written_specific_information', 'cross_sentence_connection'], sigma: 0.8, note: 'RC avg' },
  time_pressure_accuracy: { from: ['written_grammar', 'written_vocabulary', 'written_specific_information'], sigma: 0.9, note: 'RC avg (unmeasured)' },
};

export const GROUP_LABEL: Record<DisplayGroup, string> = {
  intent: 'Intent',
  gist: 'Gist',
  vocabulary: 'Vocabulary',
  grammar: 'Grammar',
  listening: 'Listening',
  reading: 'Reading',
  maintenance: 'Maintenance',
  challenge: '990 Challenge',
};

export const GROUP_LABEL_KO: Record<DisplayGroup, string> = {
  intent: '화자 의도',
  gist: '요지·목적',
  vocabulary: '어휘',
  grammar: '문법',
  listening: '듣기 기타',
  reading: '독해 기타',
  maintenance: '강점 유지',
  challenge: '990 챌린지',
};

export function skillLabel(id: SkillId): string {
  return SKILLS[id]?.label ?? id;
}
