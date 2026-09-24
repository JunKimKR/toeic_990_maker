/** Part 2 frames — second set (novelty capacity, indirect-response heavy). */
import type { P2Frame } from './part2Frames';

export const P2_FRAMES_B: P2Frame[] = [
  {
    id: 'when_renovation_done', type: 'wh_when', situation: 'maintenance',
    alts: [{ area: 'lobby' }, { area: 'cafeteria' }, { area: 'fitness room' }],
    q: (v) => `When will the ${v.x.area} renovation be finished?`,
    correct: [
      { t: () => 'By the end of the month.', lvl: 1, why: '시점을 직접 답함' },
      { t: () => "The contractor keeps changing the date.", lvl: 2, why: '일정이 계속 바뀐다 → 확실하지 않음' },
      { t: () => "They're still waiting on the flooring.", lvl: 3, why: '자재 대기 중 → 아직 멀었다는 함축' },
    ],
    wrong: [
      { t: (v) => `Yes, the ${v.x.area} looks great.`, type: 'keyword_overlap', why: '같은 명사 반복 + Yes 불가' },
      { t: () => 'On the ground floor.', type: 'wrong_question_type', why: '장소 응답' },
      { t: () => "I'm finished with the report.", type: 'similar_sound', why: 'finished 반복 함정' },
    ],
  },
  {
    id: 'where_submit_form', type: 'wh_where', situation: 'hr',
    alts: [{ form: 'vacation request' }, { form: 'expense form' }, { form: 'parking permit application' }],
    q: (v) => `Where should I submit my ${v.x.form}?`,
    correct: [
      { t: () => 'To the office on the second floor.', lvl: 1, why: '장소를 직접 답함' },
      { t: () => "It's all done online now.", lvl: 2, why: '온라인 제출 → 물리적 장소 없음' },
      { t: () => "Didn't you get the e-mail about the new system?", lvl: 3, why: '새 시스템 안내 메일을 되물음 → 방식이 바뀜' },
    ],
    wrong: [
      { t: () => 'By Friday at noon.', type: 'wrong_question_type', why: '시점 응답' },
      { t: () => 'I submitted mine yesterday.', type: 'keyword_overlap', why: 'submit 반복 — 위치를 답하지 않음' },
      { t: () => 'A request for more staff.', type: 'keyword_overlap', why: 'request 반복' },
    ],
  },
  {
    id: 'who_approve_budget', type: 'wh_who', situation: 'accounting',
    alts: [{ thing: 'the training budget' }, { thing: 'overtime pay' }, { thing: 'the new laptops' }],
    q: (v) => `Who needs to approve ${v.x.thing}?`,
    correct: [
      { t: () => 'The finance director.', lvl: 1, why: '사람을 직접 답함' },
      { t: () => "Anything over five hundred dollars goes to the director.", lvl: 2, why: '금액 기준으로 결재권자 설명' },
      { t: () => "It was already approved last week.", lvl: 3, why: '이미 승인됨 → 질문 전제가 불필요' },
    ],
    wrong: [
      { t: () => 'An approved list of vendors.', type: 'keyword_overlap', why: 'approve 반복' },
      { t: () => 'Next Thursday, probably.', type: 'wrong_question_type', why: '시점 응답' },
      { t: () => 'Yes, it needs approval.', type: 'wrong_question_type', why: 'Who 질문에 Yes 불가' },
    ],
  },
  {
    id: 'why_late_shipment', type: 'wh_why', situation: 'shipping',
    alts: [{ ship: 'the paper order' }, { ship: 'the furniture delivery' }, { ship: 'the replacement parts' }],
    q: (v) => `Why hasn't ${v.x.ship} arrived yet?`,
    correct: [
      { t: () => 'There was a problem at the port.', lvl: 1, why: '이유를 직접 답함' },
      { t: () => "The supplier hasn't returned my calls.", lvl: 2, why: '확인이 안 되는 상황 → 이유 모름' },
      { t: () => "Check the tracking page — it was updated this morning.", lvl: 3, why: '정보 위치 안내' },
    ],
    wrong: [
      { t: () => 'It arrives every Monday.', type: 'keyword_overlap', why: 'arrive 반복, 일반 일정' },
      { t: () => 'By express mail.', type: 'wrong_question_type', why: '방법 응답' },
      { t: () => 'Yes, it has.', type: 'wrong_question_type', why: 'Why 질문에 Yes 불가' },
    ],
  },
  {
    id: 'how_many_attendees', type: 'wh_how', situation: 'events',
    alts: [{ ev: 'the product launch' }, { ev: 'the charity dinner' }, { ev: 'the training session' }],
    q: (v) => `How many people have signed up for ${v.x.ev}?`,
    correct: [
      { t: () => 'About sixty so far.', lvl: 1, why: '수량을 직접 답함' },
      { t: () => "Registration doesn't close until Friday.", lvl: 2, why: '아직 마감 전 → 최종 수 미정' },
      { t: () => "We may need a bigger room.", lvl: 3, why: '더 큰 방 필요 → 많이 신청했다는 함축' },
    ],
    wrong: [
      { t: () => 'I signed the contract.', type: 'similar_sound', why: 'sign 다른 의미' },
      { t: () => 'In the main hall.', type: 'wrong_question_type', why: '장소 응답' },
      { t: () => 'It was a great launch.', type: 'keyword_overlap', why: '행사 연관 — 수량 아님' },
    ],
  },
  {
    id: 'how_often_backup', type: 'wh_how', situation: 'technology',
    alts: [{ data: 'customer database' }, { data: 'sales records' }, { data: 'project files' }],
    q: (v) => `How often do we back up the ${v.x.data}?`,
    correct: [
      { t: () => 'Every night at midnight.', lvl: 1, why: '빈도를 직접 답함' },
      { t: () => "The IT team would know for sure.", lvl: 2, why: '담당 부서 안내' },
      { t: () => "It happens automatically — you don't need to worry.", lvl: 3, why: '자동이라 걱정할 필요 없다는 응답' },
    ],
    wrong: [
      { t: () => 'Please back up a little.', type: 'similar_sound', why: 'back up 다른 의미(뒤로 물러나다)' },
      { t: () => 'On the shared drive.', type: 'wrong_question_type', why: '장소 응답' },
      { t: () => 'About ten customers.', type: 'keyword_overlap', why: '연관 어휘 + 수량 응답' },
    ],
  },
  {
    id: 'what_time_flight', type: 'wh_what', situation: 'airport',
    alts: [{ city: 'Toronto' }, { city: 'Singapore' }, { city: 'Dublin' }],
    q: (v) => `What time does your flight to ${v.x.city} leave?`,
    correct: [
      { t: () => 'At seven-fifteen.', lvl: 1, why: '시간을 직접 답함' },
      { t: () => "It's been delayed, so I'm not sure.", lvl: 2, why: '지연 → 모름' },
      { t: () => "I'm taking the train instead.", lvl: 3, why: '비행기를 안 탐 → 전제 부정' },
    ],
    wrong: [
      { t: (v) => `${v.x.city} is a beautiful city.`, type: 'keyword_overlap', why: '도시명 반복' },
      { t: () => 'Gate twelve.', type: 'wrong_question_type', why: '장소 응답' },
      { t: () => 'Please leave it on my desk.', type: 'similar_sound', why: 'leave 다른 의미' },
    ],
  },
  {
    id: 'yn_finished_draft', type: 'yes_no', situation: 'marketing',
    alts: [{ doc: 'the brochure' }, { doc: 'the press release' }, { doc: 'the website copy' }],
    q: (v) => `Have you finished the first draft of ${v.x.doc}?`,
    correct: [
      { t: () => 'Yes, I sent it to you an hour ago.', lvl: 1, why: '완료했다고 직접 답함' },
      { t: () => "I'm just adding the photos now.", lvl: 2, why: '거의 완료 → 아직 아님' },
      { t: () => "Weren't we waiting for the client's logo?", lvl: 3, why: '되물음 → 로고 없이는 못 끝냄' },
    ],
    wrong: [
      { t: () => 'The drafting table is new.', type: 'similar_sound', why: 'draft 연상 함정' },
      { t: () => 'A cold draft from the window.', type: 'similar_sound', why: 'draft 다른 의미(외풍)' },
      { t: () => 'First on the list.', type: 'keyword_overlap', why: 'first 반복' },
    ],
  },
  {
    id: 'yn_bring_laptop', type: 'yes_no', situation: 'meeting',
    alts: [{ ev: 'the client meeting' }, { ev: 'the workshop' }, { ev: 'the board presentation' }],
    q: (v) => `Should I bring my laptop to ${v.x.ev}?`,
    correct: [
      { t: () => 'Yes, you might need it for the demo.', lvl: 1, why: '직접 답함' },
      { t: () => "There'll be a computer in the room.", lvl: 2, why: '방에 컴퓨터 있음 → 필요 없음' },
      { t: () => "It's only a fifteen-minute discussion.", lvl: 3, why: '짧은 논의 → 필요 없다는 함축' },
    ],
    wrong: [
      { t: () => 'I bought a new laptop bag.', type: 'keyword_overlap', why: 'laptop 반복' },
      { t: () => 'She brought her team.', type: 'similar_sound', why: 'bring/brought 함정' },
      { t: () => 'In Conference Room A.', type: 'wrong_question_type', why: '장소 응답' },
    ],
  },
  {
    id: 'alt_call_or_email', type: 'alternative', situation: 'customer_service',
    alts: [{ who: 'the client' }, { who: 'the supplier' }, { who: 'the landlord' }],
    q: (v) => `Should we call ${v.x.who} or send an e-mail?`,
    correct: [
      { t: () => 'A phone call would be faster.', lvl: 1, why: '하나를 선택' },
      { t: () => 'Whichever you prefer.', lvl: 2, why: '선택을 상대에게 맡김' },
      { t: () => "They're in meetings all day, so they won't pick up.", lvl: 3, why: '전화 불가 → 이메일을 간접 선택' },
    ],
    wrong: [
      { t: () => 'Yes, we should.', type: 'wrong_question_type', why: '선택 의문문에 Yes 부적절' },
      { t: () => 'I called in sick yesterday.', type: 'similar_sound', why: 'call 다른 의미' },
      { t: () => 'My e-mail address changed.', type: 'keyword_overlap', why: 'e-mail 반복' },
    ],
  },
  {
    id: 'alt_window_aisle', type: 'alternative', situation: 'airport',
    alts: [{ x: 'window' }],
    q: () => 'Would you like a window seat or an aisle seat?',
    correct: [
      { t: () => 'An aisle seat, please.', lvl: 1, why: '하나를 선택' },
      { t: () => "It doesn't matter — it's a short flight.", lvl: 2, why: '상관없음' },
      { t: () => "I'll be working on my laptop the whole time.", lvl: 3, why: '노트북 작업 → 통로석 선호 함축' },
    ],
    wrong: [
      { t: () => 'Please open the window.', type: 'keyword_overlap', why: 'window 반복' },
      { t: () => 'Yes, I would.', type: 'wrong_question_type', why: '선택 의문문에 Yes 불가' },
      { t: () => 'In aisle seven, next to the bread.', type: 'similar_sound', why: 'aisle 다른 의미(매장 통로)' },
    ],
  },
  {
    id: 'neg_received_invoice', type: 'negative', situation: 'accounting',
    alts: [{ vend: 'the printing company' }, { vend: 'the caterer' }, { vend: 'the cleaning service' }],
    q: (v) => `Didn't we receive an invoice from ${v.x.vend} last week?`,
    correct: [
      { t: () => "Yes, and I've already paid it.", lvl: 1, why: '받았고 지불함' },
      { t: () => "No, I've been expecting it.", lvl: 2, why: '못 받음' },
      { t: () => "Maybe it went to the old address.", lvl: 3, why: '받지 못했을 가능성 함축' },
    ],
    wrong: [
      { t: () => 'A voice message.', type: 'similar_sound', why: 'invoice/voice 함정' },
      { t: () => 'The receipt is in the drawer.', type: 'keyword_overlap', why: 'receive/receipt 연상' },
      { t: () => 'Next week is better.', type: 'wrong_time', why: '시점 반복' },
    ],
  },
  {
    id: 'neg_training_mandatory', type: 'negative', situation: 'training',
    alts: [{ tr: 'safety training' }, { tr: 'software training' }, { tr: 'customer service training' }],
    q: (v) => `Isn't the ${v.x.tr} mandatory for everyone?`,
    correct: [
      { t: () => 'Only for new employees.', lvl: 1, why: '신입만 필수' },
      { t: () => "That's what the memo said.", lvl: 2, why: '메모 내용 → 필수라는 동의' },
      { t: () => "I finished it online last month.", lvl: 3, why: '이미 이수 → 필수 여부와 관계없이 해결' },
    ],
    wrong: [
      { t: () => 'The train was on time.', type: 'similar_sound', why: 'training/train 함정' },
      { t: () => 'Everyone enjoyed the party.', type: 'keyword_overlap', why: 'everyone 반복' },
      { t: () => 'It lasts two hours.', type: 'wrong_question_type', why: '기간 — 필수 여부 아님' },
    ],
  },
  {
    id: 'tag_meeting_canceled', type: 'tag', situation: 'meeting',
    alts: [{ m: 'the budget meeting' }, { m: 'the team lunch' }, { m: 'the site inspection' }],
    q: (v) => `${v.x.m.charAt(0).toUpperCase() + v.x.m.slice(1)} was canceled, wasn't it?`,
    correct: [
      { t: () => "Yes, it's been moved to next week.", lvl: 1, why: '취소(연기)됨' },
      { t: () => "No, it's still on for three o'clock.", lvl: 2, why: '예정대로' },
      { t: () => "Check the calendar — it was updated an hour ago.", lvl: 3, why: '최신 일정 확인 안내' },
    ],
    wrong: [
      { t: () => 'A canceled check.', type: 'keyword_overlap', why: 'canceled 반복' },
      { t: () => 'Nice to meet you, too.', type: 'similar_sound', why: 'meeting/meet 함정' },
      { t: () => 'In the conference room.', type: 'wrong_question_type', why: '장소 응답' },
    ],
  },
  {
    id: 'req_hold_elevator', type: 'request', situation: 'office',
    alts: [{ x: 'elevator' }],
    q: () => 'Could you hold the elevator for me?',
    correct: [
      { t: () => 'Sure, go ahead.', lvl: 1, why: '수락' },
      { t: () => "It's going down, not up.", lvl: 2, why: '방향이 다름 → 타도 소용없다는 함축' },
      { t: () => "It's already full, I'm afraid.", lvl: 3, why: '만원 → 못 잡아 줌' },
    ],
    wrong: [
      { t: () => 'Please hold the line.', type: 'keyword_overlap', why: 'hold 다른 용법' },
      { t: () => 'On the tenth floor.', type: 'wrong_question_type', why: '장소 응답' },
      { t: () => 'The elevator was repaired.', type: 'keyword_overlap', why: 'elevator 반복' },
    ],
  },
  {
    id: 'req_proofread', type: 'request', situation: 'contracts',
    alts: [{ doc: 'this contract' }, { doc: 'my cover letter' }, { doc: 'the grant application' }],
    q: (v) => `Would you mind proofreading ${v.x.doc} before I send it?`,
    correct: [
      { t: () => 'Not at all. Leave it on my desk.', lvl: 1, why: '수락 (Would you mind → Not at all = 해 줄게)' },
      { t: () => "Can it wait until after lunch?", lvl: 2, why: '조건부 수락' },
      { t: () => "Legal has to review it first anyway.", lvl: 3, why: '법무팀 검토 선행 → 지금은 불필요' },
    ],
    wrong: [
      { t: () => 'Yes, I mind the store.', type: 'similar_sound', why: 'mind 다른 의미' },
      { t: () => 'The proof arrived yesterday.', type: 'similar_sound', why: 'proof 연상 함정' },
      { t: () => 'I sent it by courier.', type: 'keyword_overlap', why: 'send 반복' },
    ],
  },
  {
    id: 'req_lend_charger', type: 'request', situation: 'office',
    alts: [{ item: 'phone charger' }, { item: 'calculator' }, { item: 'stapler' }],
    q: (v) => `Can I borrow your ${v.x.item} for a minute?`,
    correct: [
      { t: () => "Sure, it's in my top drawer.", lvl: 1, why: '수락' },
      { t: () => "I lent it to Sam this morning.", lvl: 2, why: '이미 빌려줌 → 불가' },
      { t: () => "There's a spare one at the front desk.", lvl: 3, why: '다른 곳 안내 — 우회적 응답' },
    ],
    wrong: [
      { t: () => "I'll pay you back tomorrow.", type: 'keyword_overlap', why: 'borrow 연상 — 역할 불일치' },
      { t: () => 'About a minute ago.', type: 'keyword_overlap', why: 'minute 반복' },
      { t: () => 'It needs to be charged.', type: 'similar_sound', why: 'charger/charged 함정' },
    ],
  },
  {
    id: 'sug_move_meeting', type: 'suggestion', situation: 'meeting',
    alts: [{ day: 'Thursday' }, { day: 'Monday afternoon' }],
    q: (v) => `Why don't we move the weekly meeting to ${v.x.day}?`,
    correct: [
      { t: () => 'That works for me.', lvl: 1, why: '동의' },
      { t: () => "Let's check with the rest of the team first.", lvl: 2, why: '팀 확인 후 결정' },
      { t: () => "Half the team works from home that day.", lvl: 3, why: '그날은 재택 인원이 많다 → 부적절' },
    ],
    wrong: [
      { t: () => 'Because it was too long.', type: 'wrong_question_type', why: 'Why don\'t we(제안)를 이유 질문으로 착각' },
      { t: () => 'We moved last year.', type: 'similar_sound', why: 'move 다른 의미(이사)' },
      { t: () => 'Every week at ten.', type: 'keyword_overlap', why: 'weekly 연관 시점' },
    ],
  },
  {
    id: 'sug_hire_caterer', type: 'suggestion', situation: 'events',
    alts: [{ ev: 'holiday party' }, { ev: 'client reception' }],
    q: (v) => `Let's hire the same caterer for the ${v.x.ev} this year.`,
    correct: [
      { t: () => 'Good idea — everyone liked the food.', lvl: 1, why: '동의' },
      { t: () => "Only if they can fit our budget.", lvl: 2, why: '조건부 동의' },
      { t: () => "Weren't there complaints about the service?", lvl: 3, why: '서비스 불만 → 반대 함축' },
    ],
    wrong: [
      { t: () => 'He was hired last year.', type: 'keyword_overlap', why: 'hire 반복' },
      { t: () => 'This year\'s calendar.', type: 'keyword_overlap', why: 'this year 반복' },
      { t: () => 'The party starts at seven.', type: 'wrong_question_type', why: '시간 — 제안에 대한 응답 아님' },
    ],
  },
  {
    id: 'offer_print_copies', type: 'offer', situation: 'office',
    alts: [{ n: 'the handouts' }, { n: 'the agenda' }],
    q: (v) => `Would you like me to print ${v.x.n} for the meeting?`,
    correct: [
      { t: () => 'Yes, twenty copies, please.', lvl: 1, why: '수락' },
      { t: () => "Thanks, but I'll share them on screen.", lvl: 2, why: '화면 공유 → 불필요' },
      { t: () => "The printer's been out of toner since Monday.", lvl: 3, why: '프린터 고장 → 불가능하다는 함축' },
    ],
    wrong: [
      { t: () => 'The print is too small.', type: 'keyword_overlap', why: 'print 명사 용법' },
      { t: () => 'The meeting went well.', type: 'wrong_time', why: '과거 회의 — 제안에 대한 응답 아님' },
      { t: () => 'I like my new desk.', type: 'similar_sound', why: 'like 반복 함정' },
    ],
  },
  {
    id: 'offer_pick_up', type: 'offer', situation: 'travel',
    alts: [{ who: 'the visiting engineers' }, { who: 'our new manager' }],
    q: (v) => `I can pick up ${v.x.who} at the airport, if you'd like.`,
    correct: [
      { t: () => "That'd be great, thanks.", lvl: 1, why: '수락' },
      { t: () => "They've already arranged a car service.", lvl: 2, why: '이미 차량 준비 → 불필요' },
      { t: () => "Their flight lands at two in the morning, though.", lvl: 3, why: '새벽 도착 → 부담스럽다는 우회적 거절/확인' },
    ],
    wrong: [
      { t: () => 'I picked up some groceries.', type: 'similar_sound', why: 'pick up 다른 의미' },
      { t: () => 'The airport is being expanded.', type: 'keyword_overlap', why: 'airport 반복' },
      { t: () => 'Gate B, I think.', type: 'wrong_question_type', why: '장소 — 제안에 대한 응답 아님' },
    ],
  },
  {
    id: 'st_budget_cut', type: 'statement', situation: 'accounting',
    alts: [{ dept: 'marketing' }, { dept: 'training' }],
    q: (v) => `The ${v.x.dept} budget is being cut by ten percent.`,
    correct: [
      { t: () => "Then we'll have to cut back on something.", lvl: 1, why: '결과를 반영한 대응' },
      { t: () => "Where did you hear that?", lvl: 2, why: '출처 확인' },
      { t: () => "That explains why my request was rejected.", lvl: 3, why: '요청 거절 이유를 연결' },
    ],
    wrong: [
      { t: () => 'He cut his finger.', type: 'similar_sound', why: 'cut 다른 의미' },
      { t: () => 'Ten percent off everything.', type: 'keyword_overlap', why: 'percent 반복 — 할인' },
      { t: () => 'A budget hotel.', type: 'keyword_overlap', why: 'budget 다른 의미(저가)' },
    ],
  },
  {
    id: 'st_client_arrived', type: 'statement', situation: 'office',
    alts: [{ who: 'Ms. Moreau' }, { who: 'The client from Lisbon' }],
    q: (v) => `${v.x.who} is waiting in the lobby.`,
    correct: [
      { t: () => "Thanks, I'll be right down.", lvl: 1, why: '대응' },
      { t: () => "Already? Our meeting isn't until ten.", lvl: 2, why: '일찍 왔다는 반응' },
      { t: () => "Could you offer some coffee? I need five more minutes.", lvl: 3, why: '시간을 벌어 달라는 부탁' },
    ],
    wrong: [
      { t: () => 'The lobby was repainted.', type: 'keyword_overlap', why: 'lobby 반복' },
      { t: () => "I'm tired of waiting in line.", type: 'keyword_overlap', why: 'waiting 반복' },
      { t: () => 'A waiting list.', type: 'keyword_overlap', why: 'waiting 반복' },
    ],
  },
  {
    id: 'st_system_slow', type: 'statement', situation: 'technology',
    alts: [{ sys: 'The ordering system' }, { sys: 'The company website' }],
    q: (v) => `${v.x.sys} is really slow today.`,
    correct: [
      { t: () => "IT is already looking into it.", lvl: 1, why: '대응 중이라는 응답' },
      { t: () => "It's probably the software update.", lvl: 2, why: '원인 추정' },
      { t: () => "Everyone's placing holiday orders at once.", lvl: 3, why: '동시 주문 폭주 → 원인 함축' },
    ],
    wrong: [
      { t: () => 'Please slow down.', type: 'keyword_overlap', why: 'slow 반복' },
      { t: () => 'A new operating system.', type: 'keyword_overlap', why: 'system 반복' },
      { t: () => 'Yes, today is Tuesday.', type: 'keyword_overlap', why: 'today 반복' },
    ],
  },
];
