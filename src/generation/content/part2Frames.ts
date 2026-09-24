/**
 * Part 2 question-response frames.
 *
 * Each frame has several correct responses graded by indirectness
 *  (1 = direct, 2 = partly indirect, 3 = indirect/990-level) and a pool of
 * typed distractors that are wrong for EVERY correct response.
 */
import type { DistractorType, SkillId, Situation } from '../../domain/types';
import type { Person } from '../lexicon';

export interface P2Vars {
  p: Person;
  p2: Person;
  day: string;
  day2: string;
  time: string;
  city: string;
  dept: string;
  company: string;
  /** frame-specific interchangeable fillers (see P2Frame.alts) */
  x: Record<string, string>;
}

export type P2Type = 'wh_when' | 'wh_where' | 'wh_who' | 'wh_why' | 'wh_how' | 'wh_what' | 'yes_no' | 'alternative' | 'negative' | 'tag' | 'request' | 'suggestion' | 'offer' | 'statement';

export interface P2Frame {
  id: string;
  type: P2Type;
  situation: Situation;
  /** interchangeable filler sets; one is chosen per generation */
  alts?: Record<string, string>[];
  q: (v: P2Vars) => string;
  correct: { t: (v: P2Vars) => string; lvl: 1 | 2 | 3; why: string }[];
  wrong: { t: (v: P2Vars) => string; type: DistractorType; why: string }[];
}

export const P2_TYPE_SKILL: Record<P2Type, SkillId> = {
  wh_when: 'short_detail',
  wh_where: 'short_detail',
  wh_who: 'short_detail',
  wh_what: 'short_gist',
  wh_why: 'short_gist',
  wh_how: 'short_gist',
  yes_no: 'short_gist',
  alternative: 'short_gist',
  negative: 'negative_question',
  tag: 'negative_question',
  request: 'indirect_response',
  suggestion: 'indirect_response',
  offer: 'indirect_response',
  statement: 'implied_meaning',
};

const S = (v: P2Vars) => (v.p.gender === 'M' ? 'he' : 'she');

export const P2_FRAMES: P2Frame[] = [
  // ------------------------------ WHEN ------------------------------
  {
    id: 'when_report_due', type: 'wh_when', situation: 'office',
    alts: [{ doc: 'budget report', head: 'budget' }, { doc: 'sales forecast', head: 'sales forecast' }, { doc: 'safety audit summary', head: 'safety audit' }, { doc: 'client proposal', head: 'proposal' }],
    q: (v) => `When is the ${v.x.doc} due?`,
    correct: [
      { t: (v) => `By the end of the day on ${v.day}.`, lvl: 1, why: '마감 시점을 직접 답함' },
      { t: () => "The director hasn't set a deadline yet.", lvl: 2, why: '아직 정해지지 않았다는 간접 응답' },
      { t: () => "Didn't you get the e-mail from Finance this morning?", lvl: 3, why: '"이메일에 나와 있다"는 뜻의 되묻기 응답' },
    ],
    wrong: [
      { t: () => 'In the conference room on the third floor.', type: 'wrong_question_type', why: 'When 질문에 장소(Where)로 답함' },
      { t: (v) => `Yes, the ${v.x.head} was approved.`, type: 'keyword_overlap', why: '같은 단어 반복 + 의문사 질문에 Yes 불가' },
      { t: () => 'I reported it to the manager.', type: 'similar_sound', why: 'report(ed) 발음 반복 함정' },
      { t: () => 'About twenty pages long.', type: 'wrong_question_type', why: '분량 — 시점을 묻는 질문과 무관' },
    ],
  },
  {
    id: 'when_shipment_arrive', type: 'wh_when', situation: 'shipping',
    alts: [{ item: 'office chairs', n: 'Twelve chairs in total.', yes: 'Yes, they are very comfortable.' }, { item: 'laptops', n: 'Eight laptops in total.', yes: 'Yes, they are very light.' }, { item: 'filing cabinets', n: 'Six cabinets in total.', yes: 'Yes, they have plenty of space.' }],
    q: (v) => `When will the new ${v.x.item} be delivered?`,
    correct: [
      { t: (v) => `They should arrive on ${v.day}.`, lvl: 1, why: '도착 요일을 직접 답함' },
      { t: () => 'The supplier is checking on that now.', lvl: 2, why: '확인 중이라는 간접 응답' },
      { t: () => 'Apparently, they were shipped from the wrong warehouse.', lvl: 3, why: '지연 원인을 말하며 아직 모른다는 뜻을 전달' },
    ],
    wrong: [
      { t: (v) => v.x.yes, type: 'keyword_overlap', why: '물건 관련 내용 + 의문사 질문에 Yes 불가' },
      { t: () => 'At the front desk.', type: 'wrong_question_type', why: '장소 응답' },
      { t: () => 'He delivered a great speech.', type: 'similar_sound', why: 'deliver의 다른 의미(연설하다)를 이용한 함정' },
      { t: (v) => v.x.n, type: 'wrong_question_type', why: '수량 응답' },
    ],
  },
  {
    id: 'when_interview', type: 'wh_when', situation: 'recruiting',
    q: (v) => `When are we interviewing the candidates for the ${v.dept} position?`,
    correct: [
      { t: (v) => `Next ${v.day} morning.`, lvl: 1, why: '시점을 직접 답함' },
      { t: () => "We're still reviewing the applications.", lvl: 2, why: '아직 서류 검토 중 → 면접 일정 미정' },
      { t: (v) => `${v.p2.title} is handling the schedule.`, lvl: 3, why: '담당자를 알려 주는 간접 응답' },
    ],
    wrong: [
      { t: () => 'Yes, I applied for it last week.', type: 'keyword_overlap', why: '의문사 질문에 Yes 불가 + 연관 어휘 함정' },
      { t: () => 'In the main conference room.', type: 'wrong_question_type', why: '장소 응답' },
      { t: () => 'She has five years of experience.', type: 'true_but_irrelevant', why: '후보자 정보 — 시점을 묻는 질문과 무관' },
    ],
  },
  // ------------------------------ WHERE ------------------------------
  {
    id: 'where_supplies', type: 'wh_where', situation: 'office',
    alts: [{ thing: 'printer paper', place: 'In the cabinet next to the copier.' }, { thing: 'name badges', place: 'In the top drawer at reception.' }, { thing: 'ink cartridges', place: 'On the shelf in the supply room.' }],
    q: (v) => `Where do we keep the extra ${v.x.thing}?`,
    correct: [
      { t: (v) => v.x.place, lvl: 1, why: '장소를 직접 답함' },
      { t: () => 'I think we just ran out.', lvl: 2, why: '"지금 없다"는 간접 응답' },
      { t: (v) => `${v.p2.title} ordered some yesterday.`, lvl: 3, why: '주문했다 → 곧 도착/담당자에게 문의하라는 함축' },
    ],
    wrong: [
      { t: () => 'Yes, please print two copies.', type: 'keyword_overlap', why: 'print 연관 + Yes 불가' },
      { t: () => 'Every Monday morning.', type: 'wrong_question_type', why: '시점 응답' },
      { t: () => 'It keeps jamming.', type: 'similar_sound', why: 'keep 반복 함정' },
    ],
  },
  {
    id: 'where_conference', type: 'wh_where', situation: 'conference',
    q: () => "Where's this year's marketing conference being held?",
    correct: [
      { t: (v) => `At a hotel in ${v.city}.`, lvl: 1, why: '장소를 직접 답함' },
      { t: () => "They haven't announced the venue yet.", lvl: 2, why: '아직 발표되지 않았다는 응답' },
      { t: () => 'Check the registration page — it was updated this morning.', lvl: 3, why: '정보 위치를 안내하는 간접 응답' },
    ],
    wrong: [
      { t: () => 'For three days in October.', type: 'wrong_question_type', why: '기간/시점 응답' },
      { t: () => 'Yes, the marketing team is attending.', type: 'keyword_overlap', why: 'marketing 반복 + Yes 불가' },
      { t: () => 'Please hold the line.', type: 'similar_sound', why: 'held/hold 발음 함정' },
    ],
  },
  // ------------------------------ WHO ------------------------------
  {
    id: 'who_order_supplies', type: 'wh_who', situation: 'office',
    q: () => "Who's in charge of ordering office supplies?",
    correct: [
      { t: (v) => `${v.p2.title} in the front office.`, lvl: 1, why: '담당자를 직접 답함' },
      { t: () => 'It used to be Maria, but she transferred.', lvl: 2, why: '전 담당자 언급 → 현재 불분명' },
      { t: () => 'What do you need? I can put it on my list.', lvl: 3, why: '자신이 대신 주문하겠다는 간접 응답' },
    ],
    wrong: [
      { t: () => 'Yes, I placed the order.', type: 'wrong_question_type', why: 'Who 질문에 Yes 불가' },
      { t: () => 'In alphabetical order.', type: 'similar_sound', why: 'order의 다른 의미(순서) 함정' },
      { t: () => 'Next to the supply closet.', type: 'keyword_overlap', why: 'supply 반복 + 장소 응답' },
    ],
  },
  {
    id: 'who_lead_training', type: 'wh_who', situation: 'training',
    q: () => "Who's leading tomorrow's safety training?",
    correct: [
      { t: () => 'Someone from the regional office.', lvl: 1, why: '사람을 답함' },
      { t: () => "It's been postponed until next month.", lvl: 3, why: '교육이 연기됨 → 질문 전제가 바뀜' },
      { t: () => "I'll check the schedule and let you know.", lvl: 2, why: '확인 후 알려 주겠다는 응답' },
    ],
    wrong: [
      { t: () => 'It starts at nine.', type: 'wrong_question_type', why: '시점 응답' },
      { t: () => 'Safety goggles are required.', type: 'keyword_overlap', why: 'safety 반복 함정' },
      { t: () => 'The train leaves at noon.', type: 'similar_sound', why: 'training/train 발음 함정' },
    ],
  },
  // ------------------------------ WHY ------------------------------
  {
    id: 'why_store_closed', type: 'wh_why', situation: 'retail',
    q: () => 'Why is the store on Main Street closed today?',
    correct: [
      { t: () => "They're installing new shelves.", lvl: 1, why: '이유를 직접 답함' },
      { t: () => "There's a sign on the door that explains it.", lvl: 2, why: '안내문에 있다는 간접 응답' },
      { t: () => "Really? I was just there this morning.", lvl: 3, why: '놀람 — 아침엔 열려 있었다는 반응(이유 모름 함축)' },
    ],
    wrong: [
      { t: () => 'Until six o\'clock.', type: 'wrong_question_type', why: '시간 응답' },
      { t: () => "It's close to the bank.", type: 'similar_sound', why: 'closed/close(가까운) 함정' },
      { t: () => 'I bought a new coat there.', type: 'keyword_overlap', why: 'store 연관 경험 — 이유 아님' },
    ],
  },
  {
    id: 'why_meeting_moved', type: 'wh_why', situation: 'meeting',
    alts: [{ m: 'client meeting' }, { m: 'budget review' }, { m: 'site visit' }],
    q: (v) => `Why was the ${v.x.m} moved to ${v.day}?`,
    correct: [
      { t: () => "The regional director's flight was delayed.", lvl: 1, why: '이유를 직접 답함' },
      { t: () => 'I only heard about the change an hour ago.', lvl: 2, why: '자신도 방금 알았다 → 이유 모름' },
      { t: () => 'You should ask Karen — she arranged it.', lvl: 3, why: '담당자에게 물어보라는 간접 응답' },
    ],
    wrong: [
      { t: () => 'In the large conference room.', type: 'wrong_question_type', why: '장소 응답' },
      { t: () => 'We moved into this building last year.', type: 'similar_sound', why: 'move(이사) 다른 의미 함정' },
      { t: (v) => `Yes, the ${v.x.m} went well.`, type: 'keyword_overlap', why: '같은 명사 반복 + 의문사 질문에 Yes 불가' },
    ],
  },
  {
    id: 'why_price_increase', type: 'wh_why', situation: 'retail',
    q: () => 'Why did the price of the monthly membership go up?',
    correct: [
      { t: () => 'We added a second swimming pool.', lvl: 1, why: '이유를 직접 답함' },
      { t: () => 'All the gyms in the area raised their prices.', lvl: 2, why: '업계 전체 인상이라는 이유' },
      { t: () => "It's still cheaper than most places downtown.", lvl: 3, why: '이유 대신 "여전히 저렴하다"로 우회 — 불만을 누그러뜨리는 응답' },
    ],
    wrong: [
      { t: () => 'Every month on the first.', type: 'keyword_overlap', why: 'monthly 연관 시점 응답' },
      { t: () => 'Please go up to the second floor.', type: 'similar_sound', why: 'go up 반복(다른 의미)' },
      { t: () => 'A membership card.', type: 'keyword_overlap', why: 'membership 반복 명사 응답' },
    ],
  },
  // ------------------------------ HOW ------------------------------
  {
    id: 'how_get_airport', type: 'wh_how', situation: 'travel',
    q: () => "What's the best way to get to the airport from here?",
    correct: [
      { t: () => 'The express train is usually fastest.', lvl: 1, why: '방법을 직접 답함' },
      { t: () => 'It depends on what time your flight leaves.', lvl: 2, why: '조건에 따라 다르다는 응답' },
      { t: () => "I'm heading there myself at four, if you need a ride.", lvl: 3, why: '태워 주겠다는 제안으로 답함' },
    ],
    wrong: [
      { t: () => 'About two hundred dollars.', type: 'wrong_question_type', why: '가격 응답' },
      { t: () => 'Gate 14, I believe.', type: 'keyword_overlap', why: '공항 연관 어휘 함정' },
      { t: () => 'It was the best trip I\'ve had.', type: 'keyword_overlap', why: 'best 반복 함정' },
    ],
  },
  {
    id: 'how_presentation', type: 'wh_how', situation: 'meeting',
    q: () => 'How did your presentation to the board go?',
    correct: [
      { t: () => 'Better than I expected.', lvl: 1, why: '결과를 직접 답함' },
      { t: () => 'They approved the full budget.', lvl: 2, why: '결과로 성공을 전달' },
      { t: () => "They've asked me to present it again to the regional directors.", lvl: 3, why: '재발표 요청 → 호평이었음을 함축' },
    ],
    wrong: [
      { t: () => 'On the fifth floor.', type: 'wrong_question_type', why: '장소 응답' },
      { t: () => 'I bought a new board game.', type: 'similar_sound', why: 'board 다른 의미 함정' },
      { t: () => 'Around thirty slides.', type: 'keyword_overlap', why: 'presentation 연관 수량 응답' },
    ],
  },
  {
    id: 'how_long_repair', type: 'wh_how', situation: 'maintenance',
    alts: [{ eq: 'elevator', alt: "You'd better use the stairs for the rest of the week." }, { eq: 'air conditioner in the lobby', alt: "I'd bring some fans from the storage room." }, { eq: 'freight elevator', alt: "We'll have to carry the deliveries up by hand for a while." }],
    q: (v) => `How long will it take to repair the ${v.x.eq}?`,
    correct: [
      { t: () => 'At least two days.', lvl: 1, why: '기간을 직접 답함' },
      { t: () => "The technician won't know until he opens it up.", lvl: 2, why: '아직 알 수 없다는 응답' },
      { t: (v) => v.x.alt, lvl: 3, why: '오래 걸린다는 뜻을 함축' },
    ],
    wrong: [
      { t: () => 'It\'s a long hallway.', type: 'keyword_overlap', why: 'long 반복 함정' },
      { t: () => 'On the ground floor.', type: 'wrong_question_type', why: '장소 응답' },
      { t: () => 'Yes, it was repaired last year.', type: 'keyword_overlap', why: 'repair 반복 + Yes 불가' },
    ],
  },
  // ------------------------------ WHAT ------------------------------
  {
    id: 'what_think_design', type: 'wh_what', situation: 'marketing',
    q: () => 'What do you think of the new logo design?',
    correct: [
      { t: () => 'I like the simpler colors.', lvl: 1, why: '의견을 직접 답함' },
      { t: () => "I haven't had a chance to look at it.", lvl: 2, why: '아직 못 봤다는 응답' },
      { t: () => "It's a lot like our competitor's, isn't it?", lvl: 3, why: '경쟁사와 비슷하다 → 부정적 의견 함축' },
    ],
    wrong: [
      { t: () => 'The designer is from Toronto.', type: 'keyword_overlap', why: 'design 연관 사실 — 의견 아님' },
      { t: () => 'I think it starts at noon.', type: 'keyword_overlap', why: 'think 반복 함정' },
      { t: () => 'A logistics company.', type: 'similar_sound', why: 'logo/logistics 발음 함정' },
    ],
  },
  {
    id: 'what_time_dinner', type: 'wh_what', situation: 'restaurant',
    q: () => 'What time is our dinner reservation?',
    correct: [
      { t: () => 'Seven thirty.', lvl: 1, why: '시간을 직접 답함' },
      { t: () => "I'll have to check my e-mail.", lvl: 2, why: '확인이 필요하다는 응답' },
      { t: () => 'We should leave the office by six, then.', lvl: 3, why: '출발 시간을 말하며 늦지 않은 시각임을 함축' },
    ],
    wrong: [
      { t: () => 'A table for six people.', type: 'keyword_overlap', why: '예약 연관 인원 응답' },
      { t: () => 'The steak was excellent.', type: 'keyword_overlap', why: 'dinner 연관 — 시간 아님' },
      { t: () => 'I have no reservations about the plan.', type: 'similar_sound', why: 'reservation 다른 의미(망설임) 함정' },
    ],
  },
  // ------------------------------ YES/NO ------------------------------
  {
    id: 'yn_finished_survey', type: 'yes_no', situation: 'hr',
    q: () => 'Have you filled out the employee satisfaction survey?',
    correct: [
      { t: () => 'Yes, I did it yesterday.', lvl: 1, why: '직접 답함' },
      { t: () => 'Is it due today?', lvl: 2, why: '마감을 되물어 아직 안 했음을 함축' },
      { t: () => "I didn't know we'd received one.", lvl: 3, why: '설문을 받은 줄도 몰랐다 → 안 했음' },
    ],
    wrong: [
      { t: () => 'The results were very positive.', type: 'keyword_overlap', why: 'survey 연관 — 응답 여부와 무관' },
      { t: () => 'Please fill up the tank.', type: 'similar_sound', why: 'fill out/fill up 함정' },
      { t: () => 'About thirty employees.', type: 'keyword_overlap', why: 'employee 반복 수량 응답' },
    ],
  },
  {
    id: 'yn_heard_merger', type: 'yes_no', situation: 'office',
    q: () => 'Did you hear that we might merge with Castell Engineering?',
    correct: [
      { t: () => 'Yes, it was in this morning\'s newsletter.', lvl: 1, why: '직접 답함' },
      { t: () => "Where did you hear that?", lvl: 2, why: '출처를 되물음 — 금시초문' },
      { t: () => "That would explain all the closed-door meetings lately.", lvl: 3, why: '들은 적은 없지만 그럴듯하다는 반응' },
    ],
    wrong: [
      { t: () => 'An engineering degree.', type: 'keyword_overlap', why: 'engineering 반복' },
      { t: () => "I'm over here.", type: 'similar_sound', why: 'hear/here 발음 함정' },
      { t: () => 'We should merge onto the highway.', type: 'similar_sound', why: 'merge 다른 의미 함정' },
    ],
  },
  {
    id: 'yn_projector_working', type: 'yes_no', situation: 'meeting',
    alts: [{ r: 'B' }, { r: '4' }, { r: 'C' }],
    q: (v) => `Is the projector in Room ${v.x.r} working again?`,
    correct: [
      { t: () => 'Yes, it was fixed this morning.', lvl: 1, why: '직접 답함' },
      { t: () => 'I\'d bring your laptop just in case.', lvl: 2, why: '확실하지 않으니 대비하라는 응답' },
      { t: () => 'The repair person is coming at two.', lvl: 3, why: '아직 수리 전 → 아직 고장' },
    ],
    wrong: [
      { t: () => 'He\'s working from home today.', type: 'keyword_overlap', why: 'working 반복 — 사람 이야기' },
      { t: () => 'The project was completed on time.', type: 'similar_sound', why: 'projector/project 함정' },
      { t: () => 'Room 204.', type: 'keyword_overlap', why: 'room 반복 장소 응답' },
    ],
  },
  // ------------------------------ ALTERNATIVE ------------------------------
  {
    id: 'alt_email_or_print', type: 'alternative', situation: 'office',
    alts: [{ doc: 'contract' }, { doc: 'floor plan' }, { doc: 'meeting agenda' }],
    q: (v) => `Should I e-mail you the ${v.x.doc} or print a copy?`,
    correct: [
      { t: () => 'E-mail is fine, thanks.', lvl: 1, why: '하나를 선택' },
      { t: () => "I'll need to sign it, so a printed copy, please.", lvl: 2, why: '이유와 함께 선택' },
      { t: () => "Actually, it's still being revised.", lvl: 3, why: '둘 다 아님 — 아직 수정 중' },
    ],
    wrong: [
      { t: () => 'Yes, I sent it.', type: 'wrong_question_type', why: '선택 의문문에 Yes 부적절' },
      { t: () => 'I printed it on both sides.', type: 'keyword_overlap', why: 'print 반복, 과거 — 선택에 답하지 않음' },
      { t: (v) => `The ${v.x.doc} is ten pages long.`, type: 'keyword_overlap', why: '같은 명사 반복 — 선택을 답하지 않음' },
    ],
  },
  {
    id: 'alt_train_or_drive', type: 'alternative', situation: 'travel',
    q: (v) => `Are you taking the train to ${v.city} or driving?`,
    correct: [
      { t: () => "I'm taking the train.", lvl: 1, why: '하나를 선택' },
      { t: () => 'Whichever is cheaper.', lvl: 2, why: '조건부 선택' },
      { t: () => 'The trip was canceled, actually.', lvl: 3, why: '전제 부정 — 출장 자체가 취소' },
    ],
    wrong: [
      { t: () => 'Yes, I am.', type: 'wrong_question_type', why: '선택 의문문에 Yes 불가' },
      { t: () => 'He trained the new staff.', type: 'similar_sound', why: 'train 다른 의미 함정' },
      { t: () => 'Three hours by car.', type: 'keyword_overlap', why: '소요 시간 — 선택을 답하지 않음' },
    ],
  },
  {
    id: 'alt_meeting_today_tomorrow', type: 'alternative', situation: 'meeting',
    q: () => 'Would you prefer to meet today or tomorrow morning?',
    correct: [
      { t: () => 'Tomorrow works better for me.', lvl: 1, why: '하나를 선택' },
      { t: () => "Today, if it doesn't take long.", lvl: 2, why: '조건부 선택' },
      { t: () => "I'm in training all day tomorrow.", lvl: 3, why: '내일 불가 → 오늘을 간접 선택' },
    ],
    wrong: [
      { t: () => 'Nice to meet you.', type: 'similar_sound', why: 'meet 반복 인사 함정' },
      { t: () => 'Yes, I would.', type: 'wrong_question_type', why: '선택 의문문에 Yes 불가' },
      { t: () => 'It was a productive morning.', type: 'keyword_overlap', why: 'morning 반복' },
    ],
  },
  // ------------------------------ NEGATIVE / TAG ------------------------------
  {
    id: 'neg_submitted_expenses', type: 'negative', situation: 'accounting',
    q: () => "Didn't you submit your travel expenses last week?",
    correct: [
      { t: () => 'Yes, on Friday.', lvl: 1, why: '제출함 (부정의문문도 Yes = 제출함)' },
      { t: () => "No, I'm still missing a hotel receipt.", lvl: 2, why: '미제출 + 이유' },
      { t: () => 'The finance office said they never got them.', lvl: 3, why: '제출했지만 분실되었다는 함축' },
    ],
    wrong: [
      { t: () => 'It was an expensive trip.', type: 'similar_sound', why: 'expenses/expensive 함정' },
      { t: () => 'Next week is fine.', type: 'wrong_time', why: '시점 반복 — 질문에 답하지 않음' },
      { t: () => 'I traveled by bus.', type: 'keyword_overlap', why: 'travel 반복' },
    ],
  },
  {
    id: 'neg_open_sunday', type: 'negative', situation: 'retail',
    alts: [{ biz: 'pharmacy', sim: "She's a pharmacist." }, { biz: 'library', sim: "She's a librarian." }, { biz: 'bakery', sim: 'He bakes his own bread.' }],
    q: (v) => `Isn't the ${v.x.biz} open on Sundays?`,
    correct: [
      { t: () => 'Only until noon.', lvl: 1, why: '열지만 정오까지' },
      { t: () => 'Not since the new owner took over.', lvl: 2, why: '더 이상 안 연다' },
      { t: () => "There's a sign on the door with the new hours.", lvl: 3, why: '영업시간이 바뀌었다는 함축' },
    ],
    wrong: [
      { t: () => 'Please open the window.', type: 'keyword_overlap', why: 'open 반복' },
      { t: (v) => v.x.sim, type: 'similar_sound', why: '비슷한 발음/어근 함정' },
      { t: () => 'Last Sunday afternoon.', type: 'wrong_time', why: '시점 반복' },
    ],
  },
  {
    id: 'tag_new_manager', type: 'tag', situation: 'hr',
    q: () => "The new manager starts on Monday, doesn't she?",
    correct: [
      { t: () => "That's what I heard.", lvl: 1, why: '동의' },
      { t: () => "No, her start date was pushed back a week.", lvl: 2, why: '부정 + 새 일정' },
      { t: () => "HR just sent out an updated announcement.", lvl: 3, why: '공지가 바뀌었다 → 확인 필요 함축' },
    ],
    wrong: [
      { t: () => 'He manages the sales team.', type: 'similar_sound', why: 'manager/manages 함정' },
      { t: () => 'A new start-up company.', type: 'keyword_overlap', why: 'new, start 반복' },
      { t: () => 'Every Monday at nine.', type: 'wrong_time', why: 'Monday 반복 시점 응답' },
    ],
  },
  {
    id: 'tag_booked_room', type: 'tag', situation: 'hotel',
    alts: [{ who: 'engineers', sim: 'An engineering firm.' }, { who: 'consultants', sim: 'A consulting firm.' }, { who: 'auditors', sim: 'The audit went well.' }],
    q: (v) => `You've booked a room for the visiting ${v.x.who}, haven't you?`,
    correct: [
      { t: () => 'Yes, at the hotel across the street.', lvl: 1, why: '예약함' },
      { t: () => "I was waiting for their arrival date.", lvl: 2, why: '아직 안 함 + 이유' },
      { t: () => "Weren't they staying with the client?", lvl: 3, why: '되물음 — 예약이 필요 없다고 알았음' },
    ],
    wrong: [
      { t: () => 'I\'m reading a good book.', type: 'similar_sound', why: 'booked/book 함정' },
      { t: (v) => v.x.sim, type: 'keyword_overlap', why: '같은 어근 반복' },
      { t: () => 'Room service, please.', type: 'keyword_overlap', why: 'room 반복' },
    ],
  },
  // ------------------------------ REQUEST ------------------------------
  {
    id: 'req_review_slides', type: 'request', situation: 'office',
    q: () => 'Could you look over my slides before the meeting?',
    correct: [
      { t: () => 'Sure, send them to me.', lvl: 1, why: '수락' },
      { t: () => "I'm with a client until three.", lvl: 2, why: '바쁘다 → 3시 이후 가능/어렵다 함축' },
      { t: () => 'Hasn\'t Paul already checked them?', lvl: 3, why: '다른 사람이 이미 봤다는 우회적 응답' },
    ],
    wrong: [
      { t: () => 'The meeting room is over there.', type: 'keyword_overlap', why: 'meeting, over 반복' },
      { t: () => 'The floor is slippery.', type: 'similar_sound', why: 'slides/slippery 연상 함정' },
      { t: () => 'Yes, it was a good meeting.', type: 'wrong_time', why: '과거 회의 — 요청에 대한 응답 아님' },
    ],
  },
  {
    id: 'req_cover_shift', type: 'request', situation: 'retail',
    q: () => 'Would you be able to cover my shift on Saturday?',
    correct: [
      { t: () => 'I think so — what time?', lvl: 1, why: '수락 + 확인' },
      { t: () => "I'm visiting my parents this weekend.", lvl: 2, why: '주말 일정 → 거절 함축' },
      { t: () => 'Ask me again after I see next week\'s schedule.', lvl: 3, why: '보류 응답' },
    ],
    wrong: [
      { t: () => 'The book cover is blue.', type: 'similar_sound', why: 'cover 다른 의미' },
      { t: () => 'He shifted the boxes.', type: 'similar_sound', why: 'shift 다른 의미' },
      { t: () => 'Last Saturday.', type: 'wrong_time', why: '시점 반복' },
    ],
  },
  {
    id: 'req_send_invoice', type: 'request', situation: 'accounting',
    q: () => 'Can you send me a copy of the invoice from Atlas Office Supply?',
    correct: [
      { t: () => "Sure, I'll forward it right away.", lvl: 1, why: '수락' },
      { t: () => 'Which month are you looking for?', lvl: 2, why: '추가 정보 요청' },
      { t: () => "It should be in the shared folder already.", lvl: 3, why: '직접 찾을 수 있다는 우회적 응답' },
    ],
    wrong: [
      { t: () => 'I bought some office supplies.', type: 'keyword_overlap', why: 'office supply 반복' },
      { t: () => 'She has a lovely voice.', type: 'similar_sound', why: 'invoice/voice 함정' },
      { t: () => 'Twenty copies, please.', type: 'keyword_overlap', why: 'copy 반복' },
    ],
  },
  // ------------------------------ SUGGESTION ------------------------------
  {
    id: 'sug_lunch_order', type: 'suggestion', situation: 'office',
    q: () => "Why don't we order lunch for the team today?",
    correct: [
      { t: () => "Good idea — I'll get the menu.", lvl: 1, why: '제안 수락' },
      { t: () => "Half the team is out at the trade show.", lvl: 3, why: '팀 절반이 없다 → 부적절하다는 함축' },
      { t: () => 'Is there room in the budget for that?', lvl: 2, why: '예산을 되물어 신중함 표시' },
    ],
    wrong: [
      { t: () => 'Because I was hungry.', type: 'wrong_question_type', why: 'Why don\'t we(제안)를 이유 질문으로 착각' },
      { t: () => 'In alphabetical order.', type: 'similar_sound', why: 'order 다른 의미' },
      { t: () => 'A table by the window, please.', type: 'keyword_overlap', why: '식당 연상 어휘 — 제안에 대한 응답 아님' },
    ],
  },
  {
    id: 'sug_hire_temp', type: 'suggestion', situation: 'hr',
    q: () => 'Maybe we should hire a temporary assistant for the busy season.',
    correct: [
      { t: () => "I was thinking the same thing.", lvl: 1, why: '동의' },
      { t: () => "Let's see what the budget allows first.", lvl: 2, why: '조건부 동의' },
      { t: () => 'Last year\'s temp took weeks to train.', lvl: 3, why: '과거 경험 → 회의적 입장 함축' },
    ],
    wrong: [
      { t: () => 'Summer is my favorite season.', type: 'keyword_overlap', why: 'season 반복' },
      { t: () => 'The temperature is rising.', type: 'similar_sound', why: 'temporary/temperature 함정' },
      { t: () => 'He was hired last year.', type: 'keyword_overlap', why: 'hire 반복' },
    ],
  },
  // ------------------------------ OFFER ------------------------------
  {
    id: 'offer_help_boxes', type: 'offer', situation: 'shipping',
    alts: [{ o: 'boxes', w: 'A box of pens.' }, { o: 'chairs', w: 'A chair by the window.' }, { o: 'monitors', w: 'A monitor with a wide screen.' }],
    q: (v) => `Do you want me to help you carry those ${v.x.o}?`,
    correct: [
      { t: () => "Thanks, that'd be great.", lvl: 1, why: '수락' },
      { t: () => "They're lighter than they look.", lvl: 2, why: '가볍다 → 도움 불필요' },
      { t: () => 'The movers will be here any minute.', lvl: 3, why: '이삿짐 업체가 온다 → 괜찮다는 거절' },
    ],
    wrong: [
      { t: () => 'We carry a wide selection.', type: 'similar_sound', why: 'carry 다른 의미(취급하다)' },
      { t: (v) => v.x.w, type: 'keyword_overlap', why: '같은 명사 반복' },
      { t: () => 'I helped her yesterday.', type: 'keyword_overlap', why: 'help 반복, 과거' },
    ],
  },
  {
    id: 'offer_drive_client', type: 'offer', situation: 'travel',
    q: () => 'Shall I drive the clients to the train station after lunch?',
    correct: [
      { t: () => "Yes, please — they're leaving at two.", lvl: 1, why: '수락' },
      { t: () => "They've already booked a taxi.", lvl: 3, why: '택시 예약 → 필요 없다' },
      { t: () => 'Only if you\'re back in time for the four o\'clock call.', lvl: 2, why: '조건부 수락' },
    ],
    wrong: [
      { t: () => 'A two-hour drive.', type: 'keyword_overlap', why: 'drive 반복' },
      { t: () => 'The station was renovated.', type: 'keyword_overlap', why: 'station 반복' },
      { t: () => 'I had a salad for lunch.', type: 'keyword_overlap', why: 'lunch 반복' },
    ],
  },
  // ------------------------------ STATEMENT ------------------------------
  {
    id: 'st_printer_broken', type: 'statement', situation: 'office',
    alts: [{ dev: 'printer', alt: 'break room' }, { dev: 'copier', alt: 'mailroom' }],
    q: (v) => `The ${v.x.dev} on this floor is jammed again.`,
    correct: [
      { t: () => "I'll call the repair service.", lvl: 1, why: '해결 행동 제시' },
      { t: (v) => `You can use the one in the ${v.x.alt}.`, lvl: 2, why: '대안 제시' },
      { t: () => "That's the third time this week.", lvl: 3, why: '잦은 고장 → 교체가 필요하다는 함축' },
    ],
    wrong: [
      { t: () => 'Strawberry jam, please.', type: 'similar_sound', why: 'jammed/jam 함정' },
      { t: () => 'On the fourth floor.', type: 'keyword_overlap', why: 'floor 반복 장소 응답' },
      { t: () => 'Yes, I printed it.', type: 'keyword_overlap', why: 'print 반복' },
    ],
  },
  {
    id: 'st_sales_down', type: 'statement', situation: 'marketing',
    q: () => 'Our online sales dropped last quarter.',
    correct: [
      { t: () => 'We should look at the website traffic data.', lvl: 1, why: '원인 분석 제안' },
      { t: () => 'So did everyone else\'s in the industry.', lvl: 2, why: '업계 전반 현상이라는 응답' },
      { t: () => 'That was when the checkout page kept crashing.', lvl: 3, why: '원인을 암시' },
    ],
    wrong: [
      { t: () => 'I dropped it off at the post office.', type: 'similar_sound', why: 'drop 다른 의미' },
      { t: () => 'A quarter past three.', type: 'similar_sound', why: 'quarter 다른 의미' },
      { t: () => 'The sale ends on Friday.', type: 'keyword_overlap', why: 'sale 반복' },
    ],
  },
  {
    id: 'st_room_cold', type: 'statement', situation: 'hotel',
    q: () => "It's really cold in this conference room.",
    correct: [
      { t: () => "I'll ask someone to adjust the heat.", lvl: 1, why: '해결 행동' },
      { t: () => 'The thermostat is right behind you.', lvl: 2, why: '직접 조절하라는 함축' },
      { t: () => 'Room 5 is free if you want to move.', lvl: 3, why: '다른 방으로 옮기자는 간접 제안' },
    ],
    wrong: [
      { t: () => 'I have a cold.', type: 'similar_sound', why: 'cold 다른 의미(감기)' },
      { t: () => 'The conference was in May.', type: 'keyword_overlap', why: 'conference 반복' },
      { t: () => 'Yes, a room for two.', type: 'keyword_overlap', why: 'room 반복' },
    ],
  },
  {
    id: 'st_deadline_tight', type: 'statement', situation: 'contracts',
    q: () => "I don't think we can finish the contract review by Friday.",
    correct: [
      { t: () => "Let's ask for an extension, then.", lvl: 1, why: '대안 제시' },
      { t: () => 'I can take the last two sections.', lvl: 2, why: '분담 제안' },
      { t: () => 'The client said the date is firm.', lvl: 3, why: '연장 불가 → 어떻게든 끝내야 함 함축' },
    ],
    wrong: [
      { t: () => 'It was a good review.', type: 'keyword_overlap', why: 'review 반복' },
      { t: () => 'Our firm has three offices.', type: 'similar_sound', why: 'firm 다른 의미 함정' },
      { t: () => 'He finished it last Friday.', type: 'wrong_time', why: 'Friday, finish 반복' },
    ],
  },
  {
    id: 'st_new_cafe', type: 'statement', situation: 'restaurant',
    q: () => 'A new café just opened across from our office.',
    correct: [
      { t: () => 'We should try it for lunch.', lvl: 1, why: '제안' },
      { t: () => 'The line was out the door this morning.', lvl: 2, why: '인기 있다는 반응' },
      { t: () => "I hope it's quieter than the last one.", lvl: 3, why: '이전 가게에 대한 불만을 함축' },
    ],
    wrong: [
      { t: () => 'Please open the file.', type: 'keyword_overlap', why: 'open 반복' },
      { t: () => 'The office is on the second floor.', type: 'keyword_overlap', why: 'office 반복' },
      { t: () => 'I opened a new account.', type: 'keyword_overlap', why: 'open 반복 — 무관' },
    ],
  },
  {
    id: 'st_client_complaint', type: 'statement', situation: 'customer_service',
    q: () => 'Mr. Haddad called again about the late delivery.',
    correct: [
      { t: () => "I'll call him back right now.", lvl: 1, why: '대응 행동' },
      { t: () => 'Did you give him the tracking number?', lvl: 2, why: '확인 질문' },
      { t: () => "The truck left the warehouse an hour ago.", lvl: 3, why: '곧 도착 → 안심시킬 정보가 있다는 함축' },
    ],
    wrong: [
      { t: () => 'He called the meeting to order.', type: 'similar_sound', why: 'call 다른 의미' },
      { t: () => 'Sorry I\'m late.', type: 'keyword_overlap', why: 'late 반복' },
      { t: () => 'A delivery truck driver.', type: 'keyword_overlap', why: 'delivery 반복' },
    ],
  },
];
