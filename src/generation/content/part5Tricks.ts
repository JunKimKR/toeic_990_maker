/**
 * Part 5 grammar "tricks". A trick is one testable rule; each has several
 * sentence frames and draws lexical material (names, companies, word families)
 * so that the same rule never shows up in the same surface form.
 *
 * Duplicate detection treats `trick.id` as the "grammar trick" (level 4) and
 * `p5.<id>` as the reasoning path (level 7), so the same rule is spaced out even
 * when the wording differs ("submitted ___ Friday" vs "received ___ Monday").
 */
import type { Rng } from '../../domain/rng';
import type { Difficulty, DistractorType } from '../../domain/types';
import { COMPANIES, CITIES, DAYS, DEPARTMENTS, MONTHS, person, Person } from '../lexicon';
import { ACTION_FAMILIES, ADJ_FAMILIES, ActionFamily } from './wordFamilies';

export interface P5Vars {
  p: Person;
  p2: Person;
  company: string;
  city: string;
  city2: string;
  day: string;
  month: string;
  dept: string;
}

export function makeVars(rng: Rng): P5Vars {
  const p = person(rng, rng.chance(0.5) ? 'M' : 'W');
  const p2 = person(rng, rng.chance(0.5) ? 'M' : 'W', [p.first, p.last]);
  const city = rng.pick(CITIES);
  return {
    p,
    p2,
    company: rng.pick(COMPANIES),
    city,
    city2: rng.pick(CITIES.filter((c) => c !== city)),
    day: rng.pick(DAYS),
    month: rng.pick(MONTHS),
    dept: rng.pick(DEPARTMENTS),
  };
}

export interface P5Distractor {
  text: string;
  type: DistractorType;
  why: string;
}

export interface P5Output {
  sentence: string; // contains "_______"
  answer: string;
  distractors: P5Distractor[];
  short: string;
  detail: string;
  lexKey: string;
  difficulty?: Difficulty;
  /** words to add to vocab tracking if missed */
  vocab?: string[];
}

export interface Trick {
  id: string;
  point: 'parts_of_speech' | 'verb_form' | 'subject_verb' | 'preposition' | 'conjunction' | 'pronoun' | 'relative_clause' | 'modifier' | 'comparison' | 'participle';
  label: string;
  difficulty: Difficulty;
  build: (rng: Rng, v: P5Vars) => P5Output;
}

export const BLANK = '_______';

const pickN = <T,>(rng: Rng, xs: T[], n: number) => rng.shuffle(xs).slice(0, n);
const d = (text: string, type: DistractorType, why: string): P5Distractor => ({ text, type, why });

// ---------------------------------------------------------------------------
// Parts of speech (adjective families)
// ---------------------------------------------------------------------------

interface AdjFrame {
  t: (v: P5Vars) => string; // contains ___
  words: string[]; // allowed family keys
  slot: 'adv' | 'adj' | 'noun';
  why: string; // korean rule
}

const ADV_FRAMES: AdjFrame[] = [
  { t: (v) => `Since ${v.company} redesigned its website, online orders have increased ${BLANK}.`, words: ['significant', 'considerable', 'substantial', 'dramatic', 'noticeable', 'steady', 'remarkable'], slot: 'adv', why: '자동사 increased 뒤에서 동사를 수식하는 자리 → 부사' },
  { t: (v) => `Operating costs at the ${v.city} plant have ${BLANK} declined over the past two quarters.`, words: ['significant', 'considerable', 'substantial', 'dramatic', 'noticeable', 'steady'], slot: 'adv', why: 'have와 과거분사 declined 사이에서 동사를 수식 → 부사' },
  { t: () => `Attendance at the monthly workshops has risen ${BLANK} since the sessions were moved online.`, words: ['significant', 'considerable', 'substantial', 'dramatic', 'noticeable', 'steady', 'remarkable'], slot: 'adv', why: '완전한 문장(주어+자동사) 뒤 수식어 자리 → 부사' },
  { t: (v) => `${v.p.title} reviewed the lease agreement ${BLANK} before sending it to the client.`, words: ['careful', 'thorough'], slot: 'adv', why: '타동사+목적어 뒤, 동작 reviewed를 수식하는 자리 → 부사' },
  { t: () => `All technicians are expected to follow the maintenance checklist ${BLANK}.`, words: ['careful', 'accurate', 'consistent', 'proper'], slot: 'adv', why: 'follow the checklist 뒤 동사구를 수식 → 부사' },
  { t: (v) => `The new scheduling software allows the ${v.dept} team to process requests more ${BLANK}.`, words: ['efficient', 'accurate', 'effective', 'prompt'], slot: 'adv', why: 'more + ___ 가 동사 process를 수식 → 부사의 비교급' },
  { t: (v) => `Customer inquiries submitted through the online form are answered ${BLANK} by the ${v.dept} staff.`, words: ['prompt', 'efficient', 'consistent'], slot: 'adv', why: '수동태 are answered를 수식 → 부사' },
  { t: (v) => `${v.company} has ${BLANK} completed the first phase of its expansion project.`, words: ['successful'], slot: 'adv', why: 'has와 completed 사이 → 동사를 수식하는 부사' },
  { t: () => `Please store the chemical samples ${BLANK} in the designated refrigerator.`, words: ['proper', 'careful'], slot: 'adv', why: '명령문 store the samples를 수식 → 부사' },
  { t: (v) => `The board of directors ${BLANK} approved the plan to open a second office in ${v.city}.`, words: ['decisive', 'immediate'], slot: 'adv', why: '주어와 동사 approved 사이 → 부사' },
  { t: () => `The survey results were ${BLANK} positive, so the pilot program will be extended.`, words: ['consistent', 'remarkable', 'exceptional', 'overwhelm'], slot: 'adv', why: '형용사 positive를 수식하는 자리 → 부사' },
  { t: () => `Ticket prices for the regional theater festival are ${BLANK} low this year.`, words: ['remarkable', 'exceptional'], slot: 'adv', why: '형용사 low를 수식 → 부사' },
];

const ADJ_FRAMES: AdjFrame[] = [
  { t: () => `The quarterly report shows a ${BLANK} increase in overseas sales.`, words: ['significant', 'considerable', 'substantial', 'dramatic', 'noticeable', 'steady', 'remarkable'], slot: 'adj', why: '관사 a와 명사 increase 사이 → 명사를 수식하는 형용사' },
  { t: (v) => `${v.company} offers ${BLANK} rates to groups of ten or more guests.`, words: ['competitive', 'affordable', 'attractive', 'exclusive'], slot: 'adj', why: '명사 rates 앞 수식 자리 → 형용사' },
  { t: () => `The position comes with a ${BLANK} benefits package, including extended parental leave.`, words: ['competitive', 'attractive', 'generous', 'comprehensive'], slot: 'adj', why: '관사와 명사구 benefits package 사이 → 형용사' },
  { t: (v) => `${v.p.title} conducted a ${BLANK} review of the supplier contracts last week.`, words: ['comprehensive', 'thorough', 'careful', 'extensive'], slot: 'adj', why: 'a ___ review: 명사를 수식하는 형용사 자리' },
  { t: (v) => `Visitors to the ${v.city} facility must wear ${BLANK} safety gear at all times.`, words: ['proper', 'additional'], slot: 'adj', why: '명사구 safety gear 앞 → 형용사' },
  { t: () => `Ms. Aldridge's proposal was ${BLANK} enough to win the committee's support.`, words: ['persuasive', 'impressive'], slot: 'adj', why: '2형식 동사 was의 보어 → 형용사 (enough는 뒤에서 수식)' },
  { t: () => `The results of the customer satisfaction survey were ${BLANK}.`, words: ['impressive', 'informative', 'encourage'], slot: 'adj', why: 'be동사 were의 보어 자리 → 형용사' },
  { t: (v) => `Because the demand is only ${BLANK}, the extra staff will be hired on short-term contracts.`, words: ['temporary'], slot: 'adj', why: 'is의 보어 → 형용사' },
  { t: (v) => `Please make sure that the figures in the ${v.dept} budget are ${BLANK} before submitting them.`, words: ['accurate'], slot: 'adj', why: 'are의 보어 → 형용사' },
  { t: () => `Staff members are encouraged to remain ${BLANK} when discussing the merger with clients.`, words: ['cautious', 'confident'], slot: 'adj', why: 'remain은 2형식 동사 → 형용사 보어' },
  { t: () => `The new filing system has proven to be ${BLANK} and easy to use.`, words: ['reliable', 'efficient', 'effective'], slot: 'adj', why: 'to be의 보어이며 and easy와 병렬 → 형용사' },
];

const NOUN_FRAMES: AdjFrame[] = [
  { t: () => `The ${BLANK} of the new inventory software has reduced errors in our shipping records.`, words: ['efficient', 'accurate', 'reliable'], slot: 'noun', why: 'The ___ of: 관사 뒤, 전치사 of 앞 → 주어 역할의 명사' },
  { t: (v) => `${v.company} is known for the ${BLANK} of its customer service team.`, words: ['prompt', 'consistent', 'reliable'], slot: 'noun', why: 'the ___ of 구조 → 명사' },
  { t: () => `We appreciate your ${BLANK} during the renovation of the main entrance.`, words: ['cooperative'], slot: 'noun', why: '소유격 your 뒤 → 명사' },
  { t: () => `Please use ${BLANK} when operating the heavy machinery in Building C.`, words: ['cautious'], slot: 'noun', why: '타동사 use의 목적어 → 명사' },
  { t: () => `Managers are asked to treat all employee records with the strictest ${BLANK}.`, words: ['confident'], slot: 'noun', why: 'the strictest ___: 최상급 형용사 뒤 → 명사 (confidence: 기밀 유지)' },
];

// extra families only used by a couple of frames
const EXTRA_ADJ: Record<string, { adj: string; adv: string; noun: string; other: string }> = {
  cooperative: { adj: 'cooperative', adv: 'cooperatively', noun: 'cooperation', other: 'cooperate' },
  overwhelm: { adj: 'overwhelming', adv: 'overwhelmingly', noun: 'overwhelm', other: 'overwhelmed' },
  encourage: { adj: 'encouraging', adv: 'encouragingly', noun: 'encouragement', other: 'encourage' },
};

function family(key: string) {
  return ADJ_FAMILIES[key] ?? EXTRA_ADJ[key];
}

function posTrick(id: string, frames: AdjFrame[], label: string, difficulty: Difficulty): Trick {
  return {
    id,
    point: 'parts_of_speech',
    label,
    difficulty,
    build: (rng, v) => {
      const fr = rng.pick(frames);
      const key = rng.pick(fr.words);
      const f = family(key);
      const answer = fr.slot === 'adv' ? f.adv : fr.slot === 'adj' ? f.adj : f.noun;
      const all = [
        { text: f.adj, slot: 'adj' },
        { text: f.adv, slot: 'adv' },
        { text: f.noun, slot: 'noun' },
        { text: f.other, slot: 'other' },
      ].filter((x) => x.text !== answer);
      const posKo: Record<string, string> = { adj: '형용사', adv: '부사', noun: '명사', other: '동사/파생형' };
      const distractors = all.map((x) =>
        d(
          x.text,
          // an adjective in an adverb slot (or vice versa) is the classic surface trap
          (fr.slot === 'adv' && x.slot === 'adj') || (fr.slot === 'adj' && x.slot === 'adv') ? 'grammar_surface_match' : 'wrong_form',
          `${x.text}: ${posKo[x.slot]} — 이 자리에 올 수 없음`,
        ),
      );
      return {
        sentence: fr.t(v),
        answer,
        distractors,
        short: `${fr.why} → ${answer}.`,
        detail: `빈칸의 위치로 품사를 결정합니다. ${fr.why}. 같은 어근(${f.adj})의 다른 형태는 문장 구조상 들어갈 수 없습니다. 해석보다 "자리"를 먼저 확인하면 5초 안에 풀 수 있는 유형입니다.`,
        lexKey: `fam:${f.adj}`,
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Action-family tricks (noun slot, to-infinitive, gerund after preposition,
// passive, perfect)
// ---------------------------------------------------------------------------

type ActionSlot = 'noun' | 'to_inf' | 'gerund' | 'passive' | 'perfect';

function actionSentence(slot: ActionSlot, a: ActionFamily, obj: string, v: P5Vars, rng: Rng): { s: string; answer: string; why: string } {
  switch (slot) {
    case 'noun':
      return rng.pick([
        { s: `Questions about the ${BLANK} of ${obj} should be directed to ${v.p.title} in ${v.dept}.`, answer: a.noun, why: 'the ___ of: 관사와 전치사 사이 → 명사' },
        { s: `The ${BLANK} of ${obj} is expected to take about three weeks.`, answer: a.noun, why: '주어 자리 the ___ of → 명사' },
        { s: `${v.p.title} will oversee the ${BLANK} of ${obj}.`, answer: a.noun, why: '타동사 oversee의 목적어 the ___ → 명사' },
      ]);
    case 'to_inf':
      return rng.pick([
        { s: `${v.company} plans to ${BLANK} ${obj} early next year.`, answer: a.base, why: 'plan to + 동사원형' },
        { s: `The committee has decided to ${BLANK} ${obj} before the end of ${v.month}.`, answer: a.base, why: 'decide to + 동사원형' },
      ]);
    case 'gerund':
      return rng.pick([
        { s: `${v.p.title} is responsible for ${BLANK} ${obj}.`, answer: a.ing, why: '전치사 for 뒤 + 목적어(obj)를 취함 → 동명사' },
        { s: `Before ${BLANK} ${obj}, the team consulted several outside experts.`, answer: a.ing, why: '전치사 Before 뒤에서 목적어를 취하는 자리 → 동명사' },
        { s: `The manager thanked the staff for ${BLANK} ${obj} ahead of schedule.`, answer: a.ing, why: '전치사 for 뒤 → 동명사 (목적어 obj가 뒤따름)' },
      ]);
    case 'passive': {
      const cap = obj.charAt(0).toUpperCase() + obj.slice(1);
      if (/^(its|a |two )/.test(obj)) {
        return { s: `The work is expected to be ${BLANK} by the end of ${v.month}.`, answer: a.pp, why: 'to be + p.p. (수동태)' };
      }
      return rng.pick([
        { s: `${cap} will be ${BLANK} by the end of ${v.month}.`, answer: a.pp, why: 'will be + p.p.: 주어가 행위의 대상 → 수동태' },
        { s: `${cap} must be ${BLANK} before the new fiscal year begins.`, answer: a.pp, why: 'must be + p.p. 수동태' },
      ]);
    }
    case 'perfect':
      return { s: `${v.company} has already ${BLANK} ${obj}, according to a company spokesperson.`, answer: a.pp, why: 'has (already) + p.p. → 현재완료' };
  }
}

function actionTrick(id: string, slot: ActionSlot, label: string, point: Trick['point'], difficulty: Difficulty): Trick {
  return {
    id,
    point,
    label,
    difficulty,
    build: (rng, v) => {
      const a = rng.pick(ACTION_FAMILIES);
      const objs = slot === 'passive' ? a.objects.filter((o) => o.startsWith('the ')) : a.objects;
      const obj = rng.pick(objs.length ? objs : a.objects);
      const { s, answer, why } = actionSentence(slot, a, obj, v, rng);
      const pool = [
        { t: a.noun, k: '명사' },
        { t: a.base, k: '동사원형' },
        { t: a.ing, k: '-ing' },
        { t: a.pp, k: '과거분사' },
        { t: a.s3, k: '3인칭 단수 현재' },
        { t: a.adj, k: '파생어' },
      ].filter((x, i, arr) => x.t !== answer && arr.findIndex((y) => y.t === x.t) === i);
      const chosen = pickN(rng, pool, 3);
      return {
        sentence: s,
        answer,
        distractors: chosen.map((x) => d(x.t, x.k === '-ing' || x.k === '과거분사' ? 'grammar_surface_match' : 'wrong_form', `${x.t}: ${x.k} — 구조상 불가`)),
        short: `${why} → ${answer}.`,
        detail: `${why}. 동사 ${a.base}(${a.ko})의 여러 형태 중 빈칸 앞뒤 구조가 요구하는 형태는 하나뿐입니다. 선택지가 같은 어근의 변형일 때는 해석하지 말고 구조부터 보세요.`,
        lexKey: `act:${a.base}`,
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Hand-built frames with slot variation
// ---------------------------------------------------------------------------

const him = (p: Person) => (p.gender === 'M' ? 'him' : 'her');
const his = (p: Person) => (p.gender === 'M' ? 'his' : 'her');
const he = (p: Person) => (p.gender === 'M' ? 'he' : 'she');
const himself = (p: Person) => (p.gender === 'M' ? 'himself' : 'herself');

const VERBS_FOR_DOCS = [
  { base: 'organize', past: 'organized', pp: 'organized', s3: 'organizes', ing: 'organizing', obj: 'all of the receipts' },
  { base: 'review', past: 'reviewed', pp: 'reviewed', s3: 'reviews', ing: 'reviewing', obj: 'the expense reports' },
  { base: 'scan', past: 'scanned', pp: 'scanned', s3: 'scans', ing: 'scanning', obj: 'the signed contracts' },
  { base: 'update', past: 'updated', pp: 'updated', s3: 'updates', ing: 'updating', obj: 'the client database' },
  { base: 'file', past: 'filed', pp: 'filed', s3: 'files', ing: 'filing', obj: 'the insurance claims' },
];

export const TRICKS: Trick[] = [
  posTrick('pos_adverb_verb', ADV_FRAMES, '부사 자리 (동사/형용사 수식)', 3),
  posTrick('pos_adjective_noun', ADJ_FRAMES, '형용사 자리 (명사 수식/보어)', 3),
  posTrick('pos_noun_slot', NOUN_FRAMES, '명사 자리 (관사/소유격 뒤)', 3),
  actionTrick('act_noun_of', 'noun', '행위 명사 the ___ of', 'parts_of_speech', 3),
  actionTrick('act_to_inf', 'to_inf', 'to + 동사원형', 'verb_form', 2),
  actionTrick('act_gerund_prep', 'gerund', '전치사 + 동명사', 'verb_form', 3),
  actionTrick('act_passive', 'passive', '수동태 be + p.p.', 'verb_form', 3),
  actionTrick('act_perfect', 'perfect', '현재완료 has + p.p.', 'verb_form', 3),

  // ---- verb tense signals ----
  {
    id: 'tense_past_perfect_by_the_time',
    point: 'verb_form',
    label: 'by the time + 과거 → 과거완료',
    difficulty: 4,
    build: (rng, v) => {
      const vb = rng.pick(VERBS_FOR_DOCS);
      return {
        sentence: `By the time the auditors arrived on ${v.day}, ${v.p.title} ${BLANK} ${vb.obj}.`,
        answer: `had ${vb.pp}`,
        distractors: [
          d(`has ${vb.pp}`, 'grammar_surface_match', '현재완료는 과거 시점(arrived) 기준 이전 완료를 나타낼 수 없음'),
          d(`will ${vb.base}`, 'wrong_form', '미래 시제 — 과거 사건과 불일치'),
          d(`${vb.ing}`, 'wrong_form', '본동사 자리에 -ing 단독 불가'),
        ],
        short: `By the time + 과거(arrived) → 그 이전에 완료 = 과거완료 had ${vb.pp}.`,
        detail: `"By the time + 과거시제" 절이 있으면 주절은 그 시점보다 먼저 끝난 일을 나타내는 과거완료(had p.p.)를 씁니다. has ${vb.pp}는 현재 기준 완료라 과거 기준점과 맞지 않습니다.`,
        lexKey: `vb:${vb.base}`,
      };
    },
  },
  {
    id: 'tense_future_perfect',
    point: 'verb_form',
    label: 'by + 미래 시점 → 미래완료',
    difficulty: 4,
    build: (rng, v) => {
      const vb = rng.pick(VERBS_FOR_DOCS);
      return {
        sentence: `By the end of next month, the ${v.dept} team ${BLANK} ${vb.obj}.`,
        answer: `will have ${vb.pp}`,
        distractors: [
          d(`had ${vb.pp}`, 'grammar_surface_match', '과거완료 — 미래 시점(next month)과 불일치'),
          d(`has been ${vb.pp}`, 'wrong_form', '수동태이며 목적어가 뒤따르므로 불가'),
          d(`${vb.past}`, 'wrong_form', '과거 시제 — 미래 기준점과 불일치'),
        ],
        short: `By + 미래 시점 → 그때까지 완료될 일 = 미래완료 will have ${vb.pp}.`,
        detail: `"By the end of next month"는 미래의 기준점입니다. 그 시점까지 완료될 동작은 will have p.p.로 씁니다. 목적어(${vb.obj})가 있으므로 수동태도 불가능합니다.`,
        lexKey: `vb:${vb.base}`,
      };
    },
  },
  {
    id: 'tense_present_perfect_since',
    point: 'verb_form',
    label: 'since + 과거 시점 → 현재완료',
    difficulty: 3,
    build: (rng, v) => {
      const opts = [
        { base: 'operate', pp: 'operated', past: 'operated', ing: 'operating', obj: `a regional office in ${v.city}` },
        { base: 'supply', pp: 'supplied', past: 'supplied', ing: 'supplying', obj: 'packaging materials to local farms' },
        { base: 'sponsor', pp: 'sponsored', past: 'sponsored', ing: 'sponsoring', obj: 'the city marathon' },
      ];
      const o = rng.pick(opts);
      const year = rng.pick(['2015', '2018', '2019', '2021']);
      return {
        sentence: `${v.company} ${BLANK} ${o.obj} since ${year}.`,
        answer: `has ${o.pp}`,
        distractors: [
          d(o.past, 'grammar_surface_match', '단순과거 — since(~이래로 지금까지)와 함께 쓰지 않음'),
          d(`will ${o.base}`, 'wrong_form', '미래 — since와 불일치'),
          d(`is ${o.ing}`, 'wrong_form', '현재진행 — since + 과거시점과 쓰지 않음'),
        ],
        short: `since + 과거 시점 → 과거부터 지금까지 = 현재완료 has ${o.pp}.`,
        detail: `since ${year}는 "그때부터 지금까지"를 뜻하므로 현재완료가 필요합니다. 단순과거 ${o.past}는 과거에 끝난 일을 나타내 since와 함께 쓰이지 않습니다.`,
        lexKey: `vb:${o.base}`,
      };
    },
  },
  {
    id: 'tense_time_clause_present',
    point: 'verb_form',
    label: '시간/조건 부사절: 현재가 미래 대신',
    difficulty: 4,
    build: (rng, v) => {
      const o = rng.pick([
        { conj: 'Once', subj: 'the contract', ans: 'is signed', ds: ['will be signed', 'signing', 'to be signed'], main: 'construction on the new warehouse will begin' },
        { conj: 'As soon as', subj: 'the replacement parts', ans: 'arrive', ds: ['will arrive', 'arriving', 'to arrive'], main: `a technician will contact you to schedule the repair` },
        { conj: 'When', subj: `${v.p.title}`, ans: 'returns', ds: ['will return', 'returning', 'to return'], main: `${he(v.p)} will review the proposals from ${v.city}` },
        { conj: 'If', subj: 'the shipment', ans: 'is delayed', ds: ['will be delayed', 'delaying', 'to be delayed'], main: 'we will notify all customers by e-mail' },
      ]);
      return {
        sentence: `${o.conj} ${o.subj} ${BLANK}, ${o.main}.`,
        answer: o.ans,
        distractors: [
          d(o.ds[0], 'grammar_surface_match', '시간·조건 부사절에서는 미래 대신 현재 시제를 씀'),
          d(o.ds[1], 'wrong_form', '절의 동사 자리에 -ing 단독 불가'),
          d(o.ds[2], 'wrong_form', '절의 동사 자리에 to부정사 불가'),
        ],
        short: `시간·조건 부사절(${o.conj})은 미래라도 현재 시제 → ${o.ans}.`,
        detail: `주절이 미래(will)여도 ${o.conj}가 이끄는 시간·조건 부사절에서는 현재 시제로 미래를 표현합니다. "will"이 들어간 보기는 의미상 자연스러워 보여 가장 많이 틀리는 함정입니다.`,
        lexKey: `conj:${o.conj}`,
      };
    },
  },
  {
    id: 'mandative_subjunctive',
    point: 'verb_form',
    label: '요구·제안 동사 + that + 동사원형',
    difficulty: 4,
    build: (rng, v) => {
      const verb = rng.pick(['requested', 'recommended', 'insisted', 'suggested', 'asked']);
      const o = rng.pick([
        { base: 'submit', s3: 'submits', past: 'submitted', ing: 'submitting', rest: `the travel expense form by ${v.day}` },
        { base: 'attend', s3: 'attends', past: 'attended', ing: 'attending', rest: 'the safety orientation' },
        { base: 'wear', s3: 'wears', past: 'wore', ing: 'wearing', rest: 'an identification badge in the lab' },
        { base: 'be', s3: 'is', past: 'was', ing: 'being', rest: 'present at the budget meeting' },
      ]);
      return {
        sentence: `The director ${verb} that every team member ${BLANK} ${o.rest}.`,
        answer: o.base,
        distractors: [
          d(o.s3, 'grammar_surface_match', 'every team member(단수)에 맞춘 3인칭 단수형 — 가정법 현재에서는 원형'),
          d(o.past, 'wrong_form', '과거형 불가 (that절은 (should) + 동사원형)'),
          d(o.ing, 'wrong_form', '동사 자리에 -ing 단독 불가'),
        ],
        short: `${verb} that + 주어 + (should) 동사원형 → ${o.base}.`,
        detail: `request/recommend/insist/suggest/ask 같은 요구·제안 동사 뒤 that절에서는 주어의 수와 관계없이 (should) + 동사원형을 씁니다. 단수 주어를 보고 ${o.s3}를 고르게 만드는 것이 이 문제의 함정입니다.`,
        lexKey: `subj:${o.base}`,
      };
    },
  },
  {
    id: 'passive_vs_active_present',
    point: 'verb_form',
    label: '능동/수동 구별 (목적어 유무)',
    difficulty: 3,
    build: (rng, v) => {
      const o = rng.pick([
        { subj: 'The quarterly figures', ans: 'are reviewed', ds: ['review', 'reviewing', 'have reviewed'], tail: `by the finance team every ${v.day}` },
        { subj: 'All outgoing packages', ans: 'are weighed', ds: ['weigh', 'weighing', 'have weighed'], tail: 'at the loading dock before shipment' },
        { subj: 'Visitor badges', ans: 'are issued', ds: ['issue', 'issuing', 'have issued'], tail: 'at the front desk in the main lobby' },
        { subj: 'Monthly newsletters', ans: 'are sent', ds: ['send', 'sending', 'have sent'], tail: 'to all registered members' },
      ]);
      return {
        sentence: `${o.subj} ${BLANK} ${o.tail}.`,
        answer: o.ans,
        distractors: [
          d(o.ds[0], 'grammar_surface_match', '능동태 — 뒤에 목적어가 없고 주어가 행위의 대상'),
          d(o.ds[1], 'wrong_form', '동사 자리에 -ing 단독 불가'),
          d(o.ds[2], 'grammar_surface_match', '능동 현재완료 — 목적어 없음'),
        ],
        short: `주어(${o.subj.toLowerCase()})가 동작의 대상이고 목적어가 없음 → 수동태 ${o.ans}.`,
        detail: `빈칸 뒤에 목적어가 없고 by/전치사구가 이어지며, 주어는 스스로 동작을 할 수 없는 사물입니다. 따라서 be + p.p. 수동태가 정답입니다.`,
        lexKey: `pass:${o.ans}`,
      };
    },
  },
  {
    id: 'participle_emotion',
    point: 'participle',
    label: '감정 분사 -ed / -ing',
    difficulty: 3,
    build: (rng, v) => {
      const o = rng.pick([
        { s: `Customers were ${BLANK} with the speed of the delivery service.`, ans: 'satisfied', ds: ['satisfying', 'satisfy', 'satisfaction'], why: '사람 주어가 감정을 "느끼는" 것 → -ed' },
        { s: `The keynote speech by ${v.p.title} was so ${BLANK} that many attendees stayed to ask questions.`, ans: 'inspiring', ds: ['inspired', 'inspire', 'inspiration'], why: '연설이 감정을 "일으키는" 것 → -ing' },
        { s: `Several employees were ${BLANK} by the sudden change in the delivery schedule.`, ans: 'confused', ds: ['confusing', 'confuse', 'confusion'], why: '사람이 혼란을 "느낀" 것 → -ed' },
        { s: `The sales figures for the third quarter were ${BLANK}, so the bonus was increased.`, ans: 'encouraging', ds: ['encouraged', 'encourage', 'encouragement'], why: '수치가 고무적인 감정을 "주는" 것 → -ing' },
        { s: `${v.p.title} was ${BLANK} to learn that the project had been approved.`, ans: 'delighted', ds: ['delighting', 'delight', 'delightful'], why: '사람이 기쁨을 "느낀" 것 → -ed' },
      ]);
      return {
        sentence: o.s,
        answer: o.ans,
        distractors: [
          d(o.ds[0], 'grammar_surface_match', '분사의 능동/수동 방향이 반대'),
          d(o.ds[1], 'wrong_form', '동사원형은 보어 자리에 올 수 없음'),
          d(o.ds[2], 'wrong_form', '명사/다른 형태 — 의미·구조 불일치'),
        ],
        short: `${o.why} → ${o.ans}.`,
        detail: `감정 동사의 분사는 주어가 감정을 느끼면 -ed, 감정을 유발하면 -ing입니다. ${o.why}.`,
        lexKey: `part:${o.ans}`,
      };
    },
  },
  {
    id: 'reduced_relative_participle',
    point: 'participle',
    label: '명사 뒤 분사 수식 (-ed / -ing)',
    difficulty: 4,
    build: (rng, v) => {
      const o = rng.pick([
        { s: `Applications ${BLANK} after ${v.day} will not be considered.`, ans: 'received', ds: ['receiving', 'receive', 'reception'], why: '지원서는 "받아지는" 대상 → 과거분사' },
        { s: `Employees ${BLANK} to attend the seminar in ${v.city} should register by ${v.day}.`, ans: 'wishing', ds: ['wished', 'wish', 'wishes'], why: '직원이 "원하는" 주체 → 현재분사' },
        { s: `Please read the documents ${BLANK} to this e-mail before the meeting.`, ans: 'attached', ds: ['attaching', 'attach', 'attachment'], why: '문서는 "첨부된" 대상 → 과거분사' },
        { s: `Only vehicles ${BLANK} a valid parking permit may use the lot behind the office.`, ans: 'displaying', ds: ['displayed', 'display', 'displays'], why: '차량이 허가증을 "게시하는" 주체, 목적어 a valid permit이 뒤따름 → 현재분사' },
        { s: `The items ${BLANK} in the spring catalog are now available in stores.`, ans: 'featured', ds: ['featuring', 'feature', 'features'], why: '상품은 카탈로그에 "실린" 대상 → 과거분사' },
      ]);
      return {
        sentence: o.s,
        answer: o.ans,
        distractors: [
          d(o.ds[0], 'grammar_surface_match', '분사의 능동/수동 방향이 반대'),
          d(o.ds[1], 'wrong_form', '문장에 이미 본동사가 있어 동사 추가 불가'),
          d(o.ds[2], 'wrong_form', '명사 뒤 수식 자리에 올 수 없는 형태'),
        ],
        short: `${o.why}.`,
        detail: `문장에 본동사가 이미 있으므로 빈칸은 앞의 명사를 뒤에서 꾸미는 분사 자리입니다. ${o.why}. 목적어가 뒤에 있으면 -ing, 없고 수동 의미면 -ed가 기본 판단 기준입니다.`,
        lexKey: `rel:${o.ans}`,
      };
    },
  },

  // ---- subject-verb agreement ----
  {
    id: 'sva_intervening_phrase',
    point: 'subject_verb',
    label: '수식어구를 건너뛴 주어-동사 수일치',
    difficulty: 4,
    build: (rng) => {
      const o = rng.pick([
        { s: `The list of approved suppliers ${BLANK} updated at the beginning of every quarter.`, ans: 'is', ds: ['are', 'be', 'being'], subj: 'The list (단수)' },
        { s: `The results of the employee survey ${BLANK} expected to be published next week.`, ans: 'are', ds: ['is', 'being', 'to be'], subj: 'The results (복수)' },
        { s: `One of the reasons for the delay ${BLANK} a shortage of qualified drivers.`, ans: 'was', ds: ['were', 'being', 'have been'], subj: 'One (단수)' },
        { s: `The proposal submitted by the two consultants ${BLANK} several cost-saving measures.`, ans: 'includes', ds: ['include', 'including', 'to include'], subj: 'The proposal (단수)' },
      ]);
      return {
        sentence: o.s,
        answer: o.ans,
        distractors: [
          d(o.ds[0], 'grammar_surface_match', '바로 앞 명사에 수를 맞춘 형태 — 진짜 주어와 불일치'),
          d(o.ds[1], 'wrong_form', '본동사 자리에 올 수 없는 형태'),
          d(o.ds[2], 'wrong_form', '본동사 자리에 올 수 없는/시제가 맞지 않는 형태'),
        ],
        short: `진짜 주어는 ${o.subj} → ${o.ans}.`,
        detail: `빈칸 바로 앞 명사가 아니라 문장의 핵심 주어(${o.subj})에 수를 맞춥니다. 전치사구·분사구가 주어와 동사 사이에 끼어 있을 때 가장 많이 틀립니다.`,
        lexKey: `sva:${o.ans}`,
      };
    },
  },
  {
    id: 'sva_each_number',
    point: 'subject_verb',
    label: 'each / the number of / a number of',
    difficulty: 4,
    build: (rng, v) => {
      const o = rng.pick([
        { s: `Each of the new laptops ${BLANK} with a two-year warranty.`, ans: 'comes', ds: ['come', 'coming', 'to come'], why: 'Each of + 복수명사 → 단수 동사' },
        { s: `The number of applicants for the ${v.dept} position ${BLANK} risen sharply this year.`, ans: 'has', ds: ['have', 'having', 'to have'], why: 'The number of ~ → 단수 동사' },
        { s: `A number of employees ${BLANK} requested flexible working hours.`, ans: 'have', ds: ['has', 'having', 'to have'], why: 'A number of + 복수명사 (= many) → 복수 동사' },
        { s: `Everyone on the ${v.dept} team ${BLANK} invited to the anniversary dinner.`, ans: 'is', ds: ['are', 'were', 'being'], why: 'Everyone → 단수 동사' },
        { s: `Neither the director nor her assistants ${BLANK} available on ${v.day}.`, ans: 'are', ds: ['is', 'was', 'being'], why: 'Neither A nor B → B(assistants, 복수)에 일치', difficulty: 5 as Difficulty },
      ]);
      return {
        sentence: o.s,
        answer: o.ans,
        distractors: [
          d(o.ds[0], 'grammar_surface_match', '수일치 오류'),
          d(o.ds[1], 'wrong_form', '본동사 자리 불가 / 수일치 오류'),
          d(o.ds[2], 'wrong_form', '본동사 자리 불가'),
        ],
        short: `${o.why} → ${o.ans}.`,
        detail: `${o.why}. 수량 표현이 주어일 때는 핵심 명사가 무엇인지(each, number, everyone)를 먼저 판단해야 합니다.`,
        lexKey: `sva2:${o.ans}`,
        difficulty: (o as { difficulty?: Difficulty }).difficulty,
      };
    },
  },

  // ---- prepositions ----
  {
    id: 'prep_by_until',
    point: 'preposition',
    label: 'by(완료 기한) vs until(지속)',
    difficulty: 3,
    build: (rng, v) => {
      const deadline = rng.chance(0.5);
      if (deadline) {
        const s = rng.pick([
          `Please return the signed agreement to ${v.p.title} ${BLANK} ${v.day}.`,
          `All travel requests must be approved ${BLANK} the end of the month.`,
          `Registration forms should reach our office ${BLANK} 5 P.M. on ${v.day}.`,
        ]);
        return {
          sentence: s,
          answer: 'by',
          distractors: [d('until', 'grammar_surface_match', 'until은 상태·동작의 "지속"(~까지 계속)'), d('since', 'wrong_form', 'since는 과거 시점부터 현재까지'), d('within', 'wrong_form', 'within 뒤에는 기간(three days 등)이 옴')],
          short: '한 번에 완료되는 동작의 기한 → by.',
          detail: 'return/approve/reach처럼 한 번 일어나면 끝나는 동작의 마감 시한에는 by를 씁니다. until은 "그때까지 계속"이라는 지속의 의미라 remain, stay, wait 등과 어울립니다.',
          lexKey: 'prep:by',
        };
      }
      const s = rng.pick([
        `The ${v.city} branch will remain closed ${BLANK} ${v.day} for renovations.`,
        `The discounted rate is valid ${BLANK} the end of ${v.month}.`,
      ]);
      const ans = 'until';
      return {
        sentence: s,
        answer: ans,
        distractors: [d('by', 'grammar_surface_match', 'by는 완료 기한 — 지속 동사(remain, keep, be valid)와 어울리지 않음'), d('since', 'wrong_form', 'since는 과거 시점부터 현재까지'), d('during', 'wrong_form', 'during 뒤에는 기간 명사가 오며 끝점을 나타내지 않음')],
        short: '상태의 지속(remain/keep/be valid) + 끝나는 시점 → until.',
        detail: 'remain closed, keep, be valid처럼 상태가 계속되다가 어느 시점에 끝나는 경우 until을 씁니다. by는 "그 전에 한 번 완료"를 뜻합니다.',
        lexKey: 'prep:until',
      };
    },
  },
  {
    id: 'prep_during_while',
    point: 'preposition',
    label: 'during(전치사) vs while(접속사)',
    difficulty: 3,
    build: (rng) => {
      const s = rng.pick([
        `Mobile phones must be switched off ${BLANK} the presentation.`,
        `Several new clients were signed ${BLANK} the three-day trade show.`,
        `Guests may use the business center free of charge ${BLANK} their stay.`,
      ]);
      return {
        sentence: s,
        answer: 'during',
        distractors: [d('while', 'grammar_surface_match', 'while은 접속사 — 뒤에 절(주어+동사)이 와야 함'), d('among', 'wrong_form', 'among은 셋 이상 "사이에서"'), d('between', 'wrong_form', 'between은 둘 사이 / A and B')],
        short: '빈칸 뒤가 명사구 → 전치사 during (while은 절을 이끄는 접속사).',
        detail: 'during과 while은 의미가 같지만 품사가 다릅니다. 뒤에 명사구(the presentation)가 오면 전치사 during, 주어+동사가 오면 접속사 while입니다.',
        lexKey: 'prep:during',
      };
    },
  },
  {
    id: 'prep_despite_although',
    point: 'preposition',
    label: 'despite(+명사) vs although(+절)',
    difficulty: 3,
    build: (rng, v) => {
      const phrase = rng.chance(0.5);
      if (phrase) {
        const s = rng.pick([
          `${BLANK} the heavy rain, the outdoor concert attracted more than 800 people.`,
          `${BLANK} rising fuel costs, ${v.company} has kept its delivery fees unchanged.`,
          `${BLANK} a limited budget, the design team produced an impressive campaign.`,
        ]);
        return {
          sentence: s,
          answer: 'Despite',
          distractors: [d('Although', 'grammar_surface_match', 'although는 접속사 — 뒤에 절이 필요'), d('However', 'wrong_form', 'however는 접속부사 — 명사구를 이끌 수 없음'), d('Because of', 'meaning_mismatch', '이유 — 양보 의미와 반대')],
          short: '뒤가 명사구 + 양보 의미 → Despite.',
          detail: '"~에도 불구하고" 의미에서 뒤에 명사구가 오면 despite / in spite of, 절이 오면 although / even though를 씁니다. because of는 문법적으로 가능하지만 의미가 반대입니다.',
          lexKey: 'prep:despite',
        };
      }
      const s = rng.pick([
        `${BLANK} the budget was limited, the team completed the project on schedule.`,
        `${BLANK} ${v.p.title} had little experience in sales, ${he(v.p)} quickly became the top performer.`,
      ]);
      return {
        sentence: s,
        answer: 'Although',
        distractors: [d('Despite', 'grammar_surface_match', 'despite는 전치사 — 절을 이끌 수 없음'), d('However', 'wrong_form', '접속부사 — 두 절을 연결하지 못함'), d('Because', 'meaning_mismatch', '이유 — 양보 의미와 반대')],
        short: '뒤가 절(주어+동사) + 양보 → Although.',
        detail: '빈칸 뒤에 주어와 동사가 있으므로 접속사가 필요합니다. 의미가 "~이지만"이므로 although가 정답이고, despite는 전치사라 절을 이끌 수 없습니다.',
        lexKey: 'prep:although',
      };
    },
  },
  {
    id: 'prep_due_to',
    point: 'preposition',
    label: 'due to(+명사) vs because(+절)',
    difficulty: 3,
    build: (rng) => {
      const s = rng.pick([
        `The flight to Osaka was delayed ${BLANK} severe weather.`,
        `The outdoor market has been postponed ${BLANK} the forecast of high winds.`,
        `Production slowed last month ${BLANK} a shortage of spare parts.`,
      ]);
      return {
        sentence: s,
        answer: 'due to',
        distractors: [d('because', 'grammar_surface_match', 'because는 접속사 — 뒤에 절 필요'), d('so that', 'wrong_form', '목적의 접속사 — 절 필요'), d('whereas', 'wrong_form', '대조의 접속사')],
        short: '뒤가 명사구 + 이유 → due to.',
        detail: '이유를 나타낼 때 명사구 앞에는 due to / because of / owing to, 절 앞에는 because / since를 씁니다.',
        lexKey: 'prep:due_to',
      };
    },
  },
  {
    id: 'prep_idiom_phrasal',
    point: 'preposition',
    label: '구전치사 (in accordance with, on behalf of ...)',
    difficulty: 4,
    build: (rng, v) => {
      const o = rng.pick([
        { s: `All hazardous waste must be disposed of ${BLANK} local regulations.`, ans: 'in accordance with', ds: ['in addition to', 'on behalf of', 'in charge of'], why: '규정에 "따라" → in accordance with' },
        { s: `${v.p.title} accepted the industry award ${BLANK} the entire ${v.dept} team.`, ans: 'on behalf of', ds: ['in spite of', 'in accordance with', 'prior to'], why: '팀을 "대표하여" → on behalf of' },
        { s: `Please arrive at least fifteen minutes ${BLANK} your scheduled appointment.`, ans: 'prior to', ds: ['ahead', 'previous', 'in front'], why: '"~보다 전에" = prior to (+명사)' },
        { s: `${BLANK} a competitive salary, the position offers flexible working hours.`, ans: 'In addition to', ds: ['Regardless', 'Even though', 'Along'], why: '"~에 더하여" → In addition to' },
        { s: `The shuttle bus departs every twenty minutes ${BLANK} weather conditions.`, ans: 'regardless of', ds: ['in case', 'even though', 'as long as'], why: '"~와 관계없이" + 명사 → regardless of' },
        { s: `${v.p.title} has been placed ${BLANK} the new quality assurance program.`, ans: 'in charge of', ds: ['on behalf of', 'in favor', 'instead'], why: '"~을 담당하는" → in charge of' },
      ]);
      return {
        sentence: o.s,
        answer: o.ans,
        distractors: o.ds.map((x) => d(x, 'meaning_mismatch', `${x}: 의미 또는 구조가 맞지 않음`)),
        short: `${o.why}.`,
        detail: `${o.why}. 구전치사는 뒤에 명사구가 오며, 비슷한 모양의 다른 구전치사/접속사를 오답으로 배치하는 경우가 많습니다. 덩어리째 의미를 알고 있어야 빠르게 풀립니다.`,
        lexKey: `idiom:${o.ans}`,
        vocab: [o.ans],
      };
    },
  },
  {
    id: 'prep_within_throughout',
    point: 'preposition',
    label: 'within / throughout / among',
    difficulty: 3,
    build: (rng, v) => {
      const o = rng.pick([
        { s: `Refund requests are usually processed ${BLANK} five business days.`, ans: 'within', ds: ['during', 'among', 'beside'], why: '기간 "이내에" → within' },
        { s: `The museum offers free guided tours ${BLANK} the summer.`, ans: 'throughout', ds: ['among', 'beside', 'onto'], why: '기간 "내내" → throughout' },
        { s: `The new flexible schedule has proved popular ${BLANK} younger employees.`, ans: 'among', ds: ['between', 'along', 'onto'], why: '집단 "사이에서" → among' },
        { s: `${v.company} has opened twelve new stores ${BLANK} the country since ${v.month}.`, ans: 'across', ds: ['among', 'between', 'onto'], why: '지역 "전역에" → across' },
      ]);
      return {
        sentence: o.s,
        answer: o.ans,
        distractors: o.ds.map((x) => d(x, 'meaning_mismatch', `${x}: 이 문맥의 의미·용법과 불일치`)),
        short: `${o.why}.`,
        detail: `${o.why}. 시간·범위 전치사는 뒤에 오는 명사(기간/집단/지역)의 성격으로 결정합니다.`,
        lexKey: `prep:${o.ans}`,
      };
    },
  },

  // ---- conjunctions ----
  {
    id: 'conj_unless_if',
    point: 'conjunction',
    label: 'unless / in case / otherwise',
    difficulty: 4,
    build: (rng, v) => {
      const o = rng.pick([
        { s: `Your order will be shipped on ${v.day} ${BLANK} you request a different delivery date.`, ans: 'unless', ds: ['otherwise', 'without', 'except'], why: '"~하지 않는 한" + 절 → unless' },
        { s: `Take an umbrella to the outdoor reception ${BLANK} it rains in the afternoon.`, ans: 'in case', ds: ['unless', 'so that', 'as though'], why: '"~할 경우에 대비해" → in case' },
        { s: `The warranty is void ${BLANK} the device has been repaired by an authorized technician.`, ans: 'unless', ds: ['otherwise', 'whereas', 'in order'], why: '"~하지 않는 한" → unless' },
      ]);
      return {
        sentence: o.s,
        answer: o.ans,
        distractors: [d(o.ds[0], 'grammar_surface_match', '접속부사/전치사 — 절을 연결하지 못하거나 의미 불일치'), d(o.ds[1], 'wrong_form', '품사 또는 의미 불일치'), d(o.ds[2], 'wrong_form', '품사 또는 의미 불일치')],
        short: `${o.why}.`,
        detail: `빈칸 뒤에 절이 있으므로 접속사 자리이고, 문맥상 ${o.why}. otherwise는 접속부사라 두 절을 직접 연결할 수 없습니다.`,
        lexKey: `conj:${o.ans}`,
      };
    },
  },
  {
    id: 'conj_so_that',
    point: 'conjunction',
    label: 'so that(+절) vs in order to(+원형)',
    difficulty: 3,
    build: (rng) => {
      const clause = rng.chance(0.5);
      if (clause) {
        const s = rng.pick([
          `Please update the shared spreadsheet ${BLANK} everyone has access to the latest figures.`,
          `The meeting was moved to the larger room ${BLANK} all the regional managers could attend.`,
        ]);
        return {
          sentence: s,
          answer: 'so that',
          distractors: [d('in order to', 'grammar_surface_match', 'in order to 뒤에는 동사원형'), d('as though', 'meaning_mismatch', '"마치 ~처럼" — 의미 불일치'), d('whereas', 'meaning_mismatch', '대조 — 의미 불일치')],
          short: '목적 + 뒤에 절(주어+동사) → so that.',
          detail: '목적을 나타낼 때 절이 오면 so that, 동사원형이 오면 in order to / so as to를 씁니다.',
          lexKey: 'conj:so_that',
        };
      }
      const s = rng.pick([
        `${BLANK} reduce waiting times, the clinic has introduced an online check-in system.`,
        `The company hired three additional drivers ${BLANK} meet the holiday demand.`,
      ]);
      return {
        sentence: s,
        answer: s.startsWith(BLANK) ? 'In order to' : 'in order to',
        distractors: [d(s.startsWith(BLANK) ? 'So that' : 'so that', 'grammar_surface_match', 'so that 뒤에는 절(주어+동사) 필요'), d(s.startsWith(BLANK) ? 'Because' : 'because', 'wrong_form', '접속사 — 절 필요'), d(s.startsWith(BLANK) ? 'As a result' : 'as a result', 'meaning_mismatch', '결과를 나타내는 연결어')],
        short: '목적 + 동사원형 → in order to.',
        detail: '빈칸 뒤가 동사원형(reduce, meet)이므로 to부정사 계열인 in order to가 맞습니다. so that은 절을 이끕니다.',
        lexKey: 'conj:in_order_to',
      };
    },
  },
  {
    id: 'conj_now_that_as_soon_as',
    point: 'conjunction',
    label: 'now that / as soon as / whereas',
    difficulty: 4,
    build: (rng, v) => {
      const o = rng.pick([
        { s: `${BLANK} the merger is complete, the two legal teams will share one office.`, ans: 'Now that', ds: ['Even if', 'So as', 'In order'], why: '"이제 ~이므로" → Now that' },
        { s: `${v.p.title} will call you ${BLANK} the replacement part arrives.`, ans: 'as soon as', ds: ['as well as', 'in case of', 'no sooner'], why: '"~하자마자" + 절 → as soon as' },
        { s: `The ${v.city} office focuses on sales, ${BLANK} the ${v.city2} office handles product development.`, ans: 'whereas', ds: ['despite', 'unless', 'therefore'], why: '두 사실의 대조 → whereas' },
      ]);
      return {
        sentence: o.s,
        answer: o.ans,
        distractors: o.ds.map((x) => d(x, 'wrong_form', `${x}: 품사(전치사/부사) 또는 의미 불일치`)),
        short: `${o.why}.`,
        detail: `빈칸은 두 절을 연결하는 접속사 자리입니다. ${o.why}. 모양이 비슷한 as well as / in case of 는 뒤에 명사가 옵니다.`,
        lexKey: `conj:${o.ans}`,
      };
    },
  },
  {
    id: 'conj_correlative',
    point: 'conjunction',
    label: '상관접속사 both/either/not only',
    difficulty: 3,
    build: (rng) => {
      const o = rng.pick([
        { s: `The new model is ${BLANK} lighter and more durable than its predecessor.`, ans: 'both', ds: ['either', 'neither', 'whether'], why: 'and와 짝 → both A and B' },
        { s: `Visitors can pay ${BLANK} by credit card or in cash at the ticket counter.`, ans: 'either', ds: ['both', 'neither', 'not only'], why: 'or와 짝 → either A or B' },
        { s: `The workshop is designed not only for managers ${BLANK} for team leaders.`, ans: 'but also', ds: ['as well', 'and also', 'so too'], why: 'not only A but also B' },
        { s: `${BLANK} the director nor the deputy director will attend the ceremony.`, ans: 'Neither', ds: ['Either', 'Both', 'Not only'], why: 'nor와 짝 → Neither A nor B' },
      ]);
      return {
        sentence: o.s,
        answer: o.ans,
        distractors: o.ds.map((x) => d(x, 'grammar_surface_match', `${x}: 짝이 되는 접속사와 불일치`)),
        short: `${o.why}.`,
        detail: `상관접속사는 짝을 먼저 찾으면 해석 없이 풀립니다: both-and, either-or, neither-nor, not only-but also.`,
        lexKey: `corr:${o.ans}`,
      };
    },
  },
  {
    id: 'conj_whether',
    point: 'conjunction',
    label: 'whether (+ to부정사/or not)',
    difficulty: 4,
    build: (rng, v) => {
      const s = rng.pick([
        `${v.p.title} has not decided ${BLANK} to attend the trade fair in ${v.city}.`,
        `The committee will discuss ${BLANK} to extend the pilot program for another year.`,
      ]);
      return {
        sentence: s,
        answer: 'whether',
        distractors: [d('if', 'grammar_surface_match', 'if는 to부정사를 바로 이끌 수 없음'), d('that', 'wrong_form', 'that + to부정사 불가'), d('what', 'wrong_form', 'what to attend는 의미·구조 불일치')],
        short: '"~할지 말지" + to부정사 → whether (if는 불가).',
        detail: 'whether와 if 모두 "~인지"를 뜻하지만, 바로 뒤에 to부정사가 오거나 전치사의 목적어일 때는 whether만 가능합니다.',
        lexKey: 'conj:whether',
      };
    },
  },

  // ---- pronouns ----
  {
    id: 'pron_reflexive',
    point: 'pronoun',
    label: '재귀대명사 (by oneself / 강조)',
    difficulty: 3,
    build: (rng, v) => {
      const s = rng.pick([
        `${v.p.title} prefers to review the final contracts ${BLANK} rather than delegate the task.`,
        `After the training session, ${v.p.title} was able to repair the printer by ${BLANK}.`,
      ]);
      return {
        sentence: s,
        answer: himself(v.p),
        distractors:
          v.p.gender === 'M'
            ? [d('him', 'grammar_surface_match', '목적격 — 강조/by oneself 자리에 불가'), d('his', 'wrong_form', '소유격/소유대명사 — 의미 불일치'), d('he', 'wrong_form', '주격 — 이 자리에 불가')]
            : [d('her', 'grammar_surface_match', '목적격 — 강조/by oneself 자리에 불가'), d('hers', 'wrong_form', '소유대명사 — 의미 불일치'), d('she', 'wrong_form', '주격 — 이 자리에 불가')],
        short: `주어 자신이 직접 → 재귀대명사 ${himself(v.p)}.`,
        detail: '"직접, 혼자서"를 뜻하는 강조 용법과 by oneself 구문에는 재귀대명사를 씁니다. 목적격(him/her)은 주어와 다른 사람을 가리킵니다.',
        lexKey: 'pron:refl',
      };
    },
  },
  {
    id: 'pron_case',
    point: 'pronoun',
    label: '대명사의 격 (소유격/목적격/소유대명사)',
    difficulty: 3,
    build: (rng) => {
      const o = rng.pick([
        { s: `Employees should keep ${BLANK} identification badges visible at all times.`, ans: 'their', ds: ['them', 'themselves', 'theirs'], why: '명사 badges 앞 → 소유격' },
        { s: `If you have any questions about the new policy, please contact ${BLANK} directly.`, ans: 'us', ds: ['our', 'ours', 'ourselves'], why: '타동사 contact의 목적어 → 목적격' },
        { s: `Their proposal was less expensive, but ${BLANK} was more detailed.`, ans: 'ours', ds: ['our', 'us', 'ourselves'], why: '"우리의 것(our proposal)" → 소유대명사' },
        { s: `The consultants presented ${BLANK} findings to the board on Tuesday.`, ans: 'their', ds: ['they', 'theirs', 'them'], why: '명사 findings 앞 → 소유격' },
      ]);
      return {
        sentence: o.s,
        answer: o.ans,
        distractors: o.ds.map((x) => d(x, 'grammar_surface_match', `${x}: 격이 맞지 않음`)),
        short: `${o.why} → ${o.ans}.`,
        detail: `${o.why}. 대명사 문제는 빈칸 뒤에 명사가 있는지(소유격), 동사/전치사의 목적어인지(목적격), 명사 없이 단독인지(소유대명사)로 결정합니다.`,
        lexKey: `pron:${o.ans}`,
      };
    },
  },
  {
    id: 'pron_those_others',
    point: 'pronoun',
    label: 'those who / others / another',
    difficulty: 4,
    build: (rng) => {
      const o = rng.pick([
        { s: `${BLANK} who wish to attend the seminar must register in advance.`, ans: 'Those', ds: ['Them', 'They', 'These'], why: '"~하는 사람들" = those who' },
        { s: `Some employees prefer to work from home, while ${BLANK} prefer the office.`, ans: 'others', ds: ['another', 'other', 'the other'], why: '불특정 다수의 "다른 사람들" → others' },
        { s: `The first shipment arrived on time, but ${BLANK} is expected next week.`, ans: 'another', ds: ['other', 'others', 'the others'], why: '단수 "또 하나(의 배송)" → another' },
      ]);
      return {
        sentence: o.s,
        answer: o.ans,
        distractors: o.ds.map((x) => d(x, 'grammar_surface_match', `${x}: 수/용법 불일치`)),
        short: `${o.why}.`,
        detail: `${o.why}. other는 뒤에 명사가 필요하고, another는 단수, others는 복수 대명사입니다.`,
        lexKey: `pron:${o.ans}`,
      };
    },
  },

  // ---- relative clauses ----
  {
    id: 'rel_whose_who_which',
    point: 'relative_clause',
    label: '관계사 whose / who / which / where / what',
    difficulty: 3,
    build: (rng, v) => {
      const o = rng.pick([
        { s: `The award goes to ${v.p.full}, ${BLANK} research improved the company's recycling program.`, ans: 'whose', ds: ['who', 'whom', 'which'], why: '뒤에 관사 없는 명사(research) + 소유 관계 → whose' },
        { s: `Employees ${BLANK} have not completed the survey should do so by ${v.day}.`, ans: 'who', ds: ['whose', 'which', 'whom'], why: '사람 선행사 + 주어 없는 절 → 주격 who' },
        { s: `The new branch in ${v.city}, ${BLANK} opened last ${v.month}, already has 2,000 members.`, ans: 'which', ds: ['who', 'where', 'what'], why: '사물 선행사 + 주어 없는 절(계속적 용법) → which' },
        { s: `The banquet will be held at the Grand Hall, ${BLANK} last year's awards ceremony took place.`, ans: 'where', ds: ['which', 'whose', 'what'], why: '장소 선행사 + 완전한 절 → 관계부사 where' },
        { s: `${BLANK} our customers value most is fast and friendly service.`, ans: 'What', ds: ['That', 'Which', 'Whose'], why: '선행사 없음 + 불완전한 절(value의 목적어 없음) → What' },
        { s: `The prize will be awarded to ${BLANK} submits the most creative logo design.`, ans: 'whoever', ds: ['whomever', 'whose', 'anyone'], why: '"~하는 누구든" + 주어 없는 절 → whoever' },
      ]);
      return {
        sentence: o.s,
        answer: o.ans,
        distractors: o.ds.map((x) => d(x, 'grammar_surface_match', `${x}: 선행사 또는 뒤 절의 구조와 불일치`)),
        short: `${o.why}.`,
        detail: `관계사는 (1) 선행사가 사람/사물/장소인지, (2) 뒤 절에 빠진 성분이 있는지로 결정합니다. ${o.why}.`,
        lexKey: `rel:${o.ans}`,
      };
    },
  },

  // ---- modifiers / comparison ----
  {
    id: 'mod_almost_most',
    point: 'modifier',
    label: 'almost / most / few / little',
    difficulty: 4,
    build: (rng) => {
      const o = rng.pick([
        { s: `${BLANK} all of the seats for the keynote address have been reserved.`, ans: 'Almost', ds: ['Most', 'Mostly', 'The most'], why: 'all을 수식하는 부사 → Almost ("most all" 불가)' },
        { s: `Very ${BLANK} changes were made to the original floor plan.`, ans: 'few', ds: ['little', 'much', 'less'], why: '가산 복수 changes → few' },
        { s: `There is ${BLANK} time left to revise the proposal before the deadline.`, ans: 'little', ds: ['few', 'many', 'fewer'], why: '불가산 time → little' },
        { s: `${BLANK} of the participants rated the workshop as useful.`, ans: 'Most', ds: ['Almost', 'Mostly', 'Much'], why: '"~의 대부분" = Most of' },
      ]);
      return {
        sentence: o.s,
        answer: o.ans,
        distractors: o.ds.map((x) => d(x, 'grammar_surface_match', `${x}: 품사 또는 가산/불가산 불일치`)),
        short: `${o.why}.`,
        detail: `${o.why}. almost는 부사라 명사를 직접 수식하지 못하고, few/many는 가산, little/much는 불가산 명사와 씁니다.`,
        lexKey: `mod:${o.ans}`,
      };
    },
  },
  {
    id: 'cmp_comparative_superlative',
    point: 'comparison',
    label: '비교급/최상급 단서',
    difficulty: 3,
    build: (rng, v) => {
      const o = rng.pick([
        { s: `This year's trade fair attracted ${BLANK} exhibitors than last year's event.`, ans: 'more', ds: ['most', 'many', 'much'], why: 'than → 비교급 more' },
        { s: `${v.company} is now the ${BLANK} supplier of office furniture in the region.`, ans: 'largest', ds: ['larger', 'large', 'largely'], why: 'the + ___ + in the region → 최상급' },
        { s: `The new printer is considerably ${BLANK} than the model it replaced.`, ans: 'faster', ds: ['fastest', 'fast', 'more fastly'], why: 'considerably(비교급 강조) + than → 비교급' },
        { s: `Of all the candidates, ${v.p.title} has the ${BLANK} experience in project management.`, ans: 'most', ds: ['more', 'many', 'much'], why: 'Of all ~ + the → 최상급 most' },
      ]);
      return {
        sentence: o.s,
        answer: o.ans,
        distractors: o.ds.map((x) => d(x, 'grammar_surface_match', `${x}: 비교 표현 단서와 불일치`)),
        short: `${o.why}.`,
        detail: `${o.why}. than이 보이면 비교급, the + 범위(in/of)가 보이면 최상급. much/even/still/far/considerably는 비교급을 강조합니다.`,
        lexKey: `cmp:${o.ans}`,
      };
    },
  },
  {
    id: 'mod_so_such_enough',
    point: 'modifier',
    label: 'so/such ~ that, enough, too',
    difficulty: 4,
    build: (rng) => {
      const o = rng.pick([
        { s: `The demand for the limited edition was ${BLANK} high that the store sold out by noon.`, ans: 'so', ds: ['such', 'too', 'very'], why: 'so + 형용사 + that' },
        { s: `It was ${BLANK} a successful event that the organizers plan to hold it twice a year.`, ans: 'such', ds: ['so', 'too', 'very'], why: 'such + a + 형용사 + 명사 + that' },
        { s: `The conference room is not large ${BLANK} to hold all fifty participants.`, ans: 'enough', ds: ['too', 'so', 'very'], why: '형용사 + enough + to부정사' },
        { s: `The instructions were ${BLANK} complicated for most users to follow without help.`, ans: 'too', ds: ['so', 'such', 'enough'], why: 'too + 형용사 + for + 사람 + to부정사' },
      ]);
      return {
        sentence: o.s,
        answer: o.ans,
        distractors: o.ds.map((x) => d(x, 'grammar_surface_match', `${x}: 뒤따르는 구조(that/to/명사)와 불일치`)),
        short: `${o.why}.`,
        detail: `${o.why}. so는 형용사/부사, such는 (a) + 형용사 + 명사 앞에 오고, enough는 형용사 뒤에 위치합니다.`,
        lexKey: `mod:${o.ans}`,
      };
    },
  },
  {
    id: 'mod_ly_meaning_shift',
    point: 'modifier',
    label: '-ly로 의미가 달라지는 부사 (highly, hardly, nearly, lately)',
    difficulty: 5,
    build: (rng, v) => {
      const o = rng.pick([
        { s: `${v.p.title} comes ${BLANK} recommended by ${his(v.p)} previous employer.`, ans: 'highly', ds: ['high', 'higher', 'height'], why: 'highly = 매우 (high는 "높이" 물리적 의미)' },
        { s: `There is ${BLANK} any parking available near the convention center on weekends.`, ans: 'hardly', ds: ['hard', 'harder', 'hardness'], why: 'hardly any = 거의 없는 (hard는 "열심히/어려운")' },
        { s: `The renovation of the ${v.city} showroom is ${BLANK} complete.`, ans: 'nearly', ds: ['near', 'nearest', 'nearness'], why: 'nearly = 거의 (near는 "가까이" 공간)' },
        { s: `Online sales have been unusually strong ${BLANK}.`, ans: 'lately', ds: ['late', 'later', 'latest'], why: 'lately = 최근에 (현재완료와 어울림; late는 "늦게")' },
      ]);
      return {
        sentence: o.s,
        answer: o.ans,
        distractors: o.ds.map((x) => d(x, 'grammar_surface_match', `${x}: 형태는 비슷하지만 의미·품사 불일치`)),
        short: `${o.why}.`,
        detail: `${o.why}. -ly가 붙으면 의미 자체가 바뀌는 부사 쌍(high/highly, hard/hardly, near/nearly, late/lately)은 990 구간에서 자주 출제됩니다.`,
        lexKey: `ly:${o.ans}`,
        vocab: [o.ans],
      };
    },
  },
];

export const TRICK_BY_ID = Object.fromEntries(TRICKS.map((t) => [t.id, t]));
