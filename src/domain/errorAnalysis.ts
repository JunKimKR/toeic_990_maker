/**
 * Error analysis: estimate *why* an answer was wrong from observable signals
 * (which distractor type was chosen, skill of the item, response time, replays,
 * confidence, answer changes). The output is phrased as a likelihood, never
 * as a claim about what the learner "thought".
 */
import type { ConfidenceLevel, DistractorType, MistakeCause, Part, SkillId } from './types';

export interface ErrorSignal {
  part: Part;
  skill: SkillId;
  correct: boolean;
  chosenDistractor: DistractorType | null;
  responseMs: number;
  typicalMs: number;
  plays: number;
  confidence: ConfidenceLevel | null;
  answerChanges: number;
  firstChoiceWasCorrect: boolean;
  timedOut: boolean;
}

const GIST_SKILLS: SkillId[] = ['extended_gist', 'short_gist', 'purpose_identification', 'purpose', 'speaker_relationship', 'location_context'];
const INTENT_SKILLS: SkillId[] = ['speaker_intent', 'implied_meaning', 'indirect_response', 'next_action_prediction'];
const DETAIL_SKILLS: SkillId[] = ['short_detail', 'extended_detail', 'specific_information', 'visual_information_linking'];

export function inferMistakeCauses(s: ErrorSignal): MistakeCause[] {
  if (s.correct) return [];
  const causes: MistakeCause[] = [];
  const add = (c: MistakeCause) => {
    if (!causes.includes(c)) causes.push(c);
  };
  if (s.timedOut) add('time_pressure');

  switch (s.chosenDistractor) {
    case 'keyword_overlap':
    case 'similar_sound':
      add('distractor_keyword_match');
      break;
    case 'literal_interpretation':
      add('literal_interpretation');
      break;
    case 'true_but_irrelevant':
      add(GIST_SKILLS.includes(s.skill) || INTENT_SKILLS.includes(s.skill) ? 'missed_gist' : 'missed_detail');
      break;
    case 'wrong_person':
    case 'wrong_time':
      add('missed_detail');
      break;
    case 'opposite_meaning':
      add(INTENT_SKILLS.includes(s.skill) ? 'speaker_intent_failure' : 'missed_detail');
      break;
    case 'reasonable_but_unstated':
      add('inference_error');
      break;
    case 'grammar_surface_match':
    case 'wrong_form':
      add(s.skill === 'vocabulary' ? 'vocabulary_gap' : 'grammar_rule_confusion');
      break;
    case 'collocation_mismatch':
    case 'meaning_mismatch':
      add('vocabulary_gap');
      break;
    case 'wrong_question_type':
      add('missed_detail');
      break;
    default:
      break;
  }

  if (INTENT_SKILLS.includes(s.skill) && !causes.includes('literal_interpretation')) add('speaker_intent_failure');
  if (GIST_SKILLS.includes(s.skill) && causes.length === 0) add('missed_gist');
  if ((s.skill === 'paraphrase_recognition' || s.skill === 'paraphrase') && !causes.includes('missed_paraphrase')) add('missed_paraphrase');
  if (s.skill === 'vocabulary') add('vocabulary_gap');
  if (s.skill === 'grammar' && causes.length === 0) add('grammar_rule_confusion');
  if (DETAIL_SKILLS.includes(s.skill) && causes.length === 0) add('missed_detail');
  if (s.skill === 'inference' && causes.length === 0) add('inference_error');

  const slow = s.responseMs > 2 * s.typicalMs;
  if ((s.answerChanges > 0 && s.firstChoiceWasCorrect) || (slow && s.confidence !== 0 && !s.timedOut)) add('overthinking');
  if (causes.length === 0) add('inference_error');
  return causes;
}

const DISTRACTOR_EXPLAIN: Record<DistractorType, string> = {
  keyword_overlap: '들린(보인) 단어가 그대로 들어간 보기였습니다. 단어가 겹친다고 정답은 아닙니다.',
  true_but_irrelevant: '지문에서 실제로 언급된 내용이지만, 질문이 묻는 것에 대한 답은 아닙니다.',
  wrong_person: '언급된 내용이지만 다른 사람에 관한 정보입니다.',
  wrong_time: '언급된 시점/일정과 다른 정보입니다.',
  opposite_meaning: '화자가 전달하려는 뜻과 반대 방향의 해석입니다.',
  literal_interpretation: '문장의 표면적 의미 그대로의 해석입니다. 이 말을 "왜" 했는지가 핵심입니다.',
  reasonable_but_unstated: '그럴듯하지만 지문에 근거가 없는 추측입니다.',
  grammar_surface_match: '빈칸 주변 단어만 보고 고르기 쉬운 형태입니다. 문장 구조 전체를 확인해야 합니다.',
  similar_sound: '질문의 단어와 발음이 비슷한 단어를 이용한 함정입니다.',
  wrong_question_type: '질문 유형(의문사)에 맞지 않는 응답입니다.',
  wrong_form: '같은 어근이지만 빈칸 자리에 올 수 없는 품사/형태입니다.',
  collocation_mismatch: '의미는 비슷해 보이지만 이 문맥의 연어(collocation)로 쓰이지 않습니다.',
  meaning_mismatch: '문맥상 의미가 맞지 않습니다.',
};

export function explainDistractor(t: DistractorType): string {
  return DISTRACTOR_EXPLAIN[t];
}

const CAUSE_LABEL: Record<MistakeCause, string> = {
  missed_detail: '세부 정보 누락',
  missed_gist: '요지·목적 놓침',
  literal_interpretation: '문자 그대로 해석',
  missed_paraphrase: '패러프레이즈 인식 실패',
  speaker_intent_failure: '화자 의도 파악 실패',
  distractor_keyword_match: '키워드 일치 함정',
  grammar_rule_confusion: '문법 규칙 혼동',
  vocabulary_gap: '어휘 공백',
  time_pressure: '시간 압박',
  overthinking: '과잉 고민',
  inference_error: '근거 없는 추론',
};

export function causeLabel(c: MistakeCause): string {
  return CAUSE_LABEL[c];
}

export const DISTRACTOR_LABEL: Record<DistractorType, string> = {
  keyword_overlap: '키워드 겹침',
  true_but_irrelevant: '사실이지만 무관',
  wrong_person: '다른 사람',
  wrong_time: '다른 시점',
  opposite_meaning: '반대 의미',
  literal_interpretation: '문자적 해석',
  reasonable_but_unstated: '그럴듯한 추측',
  grammar_surface_match: '표면 형태 일치',
  similar_sound: '유사 발음',
  wrong_question_type: '의문사 불일치',
  wrong_form: '품사/형태 오류',
  collocation_mismatch: '연어 불일치',
  meaning_mismatch: '의미 불일치',
};

/** One hedged sentence for the result card. */
export function diagnose(s: ErrorSignal, causes: MistakeCause[]): string {
  if (s.correct) {
    if (s.confidence === 0) return '정답이지만 확신이 없었습니다. 아직 불안정한 지식일 가능성이 있어 다시 출제됩니다.';
    if (s.plays > 2) return `정답이지만 ${s.plays}회 재생했습니다. 한 번에 잡는 것을 목표로 다시 훈련합니다.`;
    return '';
  }
  const c = causes[0];
  const confidentWrong = s.confidence === 2;
  const prefix = confidentWrong ? '확신한 오답입니다. 잘못 굳어진 규칙/해석일 가능성이 있어 우선 교정합니다. ' : '';
  switch (c) {
    case 'missed_gist':
      return prefix + (DETAIL_SKILLS.includes(s.skill)
        ? '이번 응답 패턴에서는 핵심 정보 대신 주변 정보에 주의가 간 것으로 보입니다.'
        : '세부 정보는 들었을 가능성이 높지만, 전체 목적보다 특정 정보에 집중한 것으로 보입니다.');
    case 'literal_interpretation':
      return prefix + '문장을 표면 의미 그대로 해석했을 가능성이 높습니다. 이 말이 대화 흐름에서 어떤 역할(제안·거절·걱정 등)을 하는지 보세요.';
    case 'speaker_intent_failure':
      return prefix + '화자가 그 말을 한 이유(의도)를 놓쳤을 가능성이 높습니다. 직전 문장과의 관계를 확인하세요.';
    case 'distractor_keyword_match':
      return prefix + '지문과 같은/비슷한 단어가 들어간 보기를 고른 패턴입니다. 990 구간에서 가장 흔한 함정입니다.';
    case 'missed_detail':
      return prefix + '세부 정보(사람·시간·대상)를 혼동했을 가능성이 있습니다.';
    case 'missed_paraphrase':
      return prefix + '지문의 표현이 다른 말로 바뀐(패러프레이즈) 정답을 연결하지 못했을 가능성이 있습니다.';
    case 'grammar_rule_confusion':
      return prefix + '빈칸 주변만 보고 형태를 고른 것으로 보입니다. 문장의 주어·동사·수식 구조를 먼저 확인하세요.';
    case 'vocabulary_gap':
      return prefix + '어휘 의미/연어가 확실하지 않았을 가능성이 높습니다. 단어장에 추가되어 새로운 문맥으로 다시 나옵니다.';
    case 'time_pressure':
      return prefix + '제한 시간 안에 답하지 못했습니다.';
    case 'overthinking':
      return prefix + '처음 판단을 바꾸거나 오래 고민한 뒤 틀렸습니다. 과잉 해석 가능성이 있습니다.';
    case 'inference_error':
    default:
      return prefix + '지문에 근거가 없는 추론을 선택했을 가능성이 있습니다. 근거 문장을 찾을 수 있는 보기만 남기세요.';
  }
}
