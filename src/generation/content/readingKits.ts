/**
 * Reading passage kits for Part 6 / Part 7 style maintenance items.
 * Each kit renders a short business text from variables and exposes the
 * facts needed for purpose / detail / inference / vocabulary / insertion /
 * connector questions.
 */
import type { DistractorType, Situation } from '../../domain/types';
import type { Person } from '../lexicon';

export interface RV {
  P: Person; // writer
  R: Person; // recipient
  company: string;
  city: string;
  day: string;
  day2: string;
  month: string;
  n: string;
  alt: Record<string, string>;
}

export interface ROpt {
  text: string;
  type: DistractorType;
}

export interface ReadingKit {
  id: string;
  situation: Situation;
  genre: string; // e-mail, notice ...
  alts: Record<string, string>[];
  heading: (v: RV) => string;
  /** sentences; exactly one sentence is marked as the insertion target via insertIndex */
  sentences: (v: RV) => string[];
  /** sentence that can be removed and re-inserted: must depend on the previous sentence */
  insertIndex: number;
  /** connector question: index of the sentence starting with the connector, and the connector */
  connector: { index: number; word: string; wrong: string[]; why: string };
  purpose: (v: RV) => { stem: string; answer: string; d: ROpt[] };
  detail: (v: RV) => { stem: string; answer: string; d: ROpt[] };
  inference: (v: RV) => { stem: string; answer: string; d: ROpt[]; why: string };
  vocab: { word: string; answer: string; d: string[]; why: string };
}

const o = (text: string, type: DistractorType): ROpt => ({ text, type });

export const READING_KITS: ReadingKit[] = [
  {
    id: 'relocation_email',
    situation: 'office',
    genre: 'E-mail',
    alts: [{ from: 'Harbor Road', to: 'Kingsley Boulevard' }, { from: 'Elm Street', to: 'Riverside Drive' }, { from: 'Station Road', to: 'Lakeview Avenue' }],
    heading: (v) => `To: All staff\nFrom: ${v.P.full}\nSubject: Office move`,
    sentences: (v) => [
      `As many of you know, our ${v.city} team will move from ${v.alt.from} to the new building on ${v.alt.to} at the end of ${v.month}.`,
      `The new space is larger and much closer to the train station.`,
      `It also includes a staff kitchen and two additional meeting rooms.`,
      `Movers will pack all equipment on ${v.day}, so please label your belongings before you leave on ${v.day2}.`,
      `However, personal items such as plants and photographs should be taken home in advance.`,
      `If you have any questions, please contact ${v.R.title} in facilities.`,
    ],
    insertIndex: 2,
    connector: { index: 4, word: 'However', wrong: ['Therefore', 'For example', 'Similarly'], why: '앞 문장(이삿짐 업체가 모두 포장)과 대조되는 예외(개인 물품은 직접)를 도입 → However' },
    purpose: () => ({ stem: 'What is the purpose of the e-mail?', answer: 'To give instructions about an upcoming move', d: [o('To announce the opening of a train station', 'keyword_overlap'), o('To request volunteers for a project', 'reasonable_but_unstated'), o('To introduce a new facilities manager', 'wrong_person')] }),
    detail: (v) => ({ stem: `What are employees asked to do before ${v.day2}?`, answer: 'Label their belongings', d: [o('Pack their own equipment', 'opposite_meaning'), o('Visit the new building', 'reasonable_but_unstated'), o('Reserve a meeting room', 'keyword_overlap')] }),
    inference: () => ({ stem: 'What is suggested about the new building?', answer: 'It will be more convenient for commuters.', d: [o('It is smaller than the current office.', 'opposite_meaning'), o('It is still under construction.', 'reasonable_but_unstated'), o('It has no meeting rooms.', 'opposite_meaning')], why: '"much closer to the train station" → 통근이 더 편리' }),
    vocab: { word: 'space', answer: 'area', d: ['period', 'gap', 'universe'], why: 'the new space = 새 공간(사무실 면적/장소)' },
  },
  {
    id: 'maintenance_notice',
    situation: 'maintenance',
    genre: 'Notice',
    alts: [{ sys: 'water supply', place: 'the east wing' }, { sys: 'elevators', place: 'Tower B' }, { sys: 'heating system', place: 'the north building' }],
    heading: () => 'NOTICE TO ALL TENANTS',
    sentences: (v) => [
      `Routine maintenance of the ${v.alt.sys} in ${v.alt.place} will take place on ${v.day}, from 8 A.M. to 2 P.M.`,
      `During this time, service will be unavailable throughout the building.`,
      `This work is required every two years under city safety regulations.`,
      `We recognize that this may cause some inconvenience.`,
      `Therefore, the management office will stay open until 8 P.M. that evening to answer questions.`,
      `We appreciate your patience and cooperation.`,
    ],
    insertIndex: 2,
    connector: { index: 4, word: 'Therefore', wrong: ['However', 'Otherwise', 'In contrast'], why: '불편을 인지 → 그래서(결과로) 사무실을 늦게까지 운영 → Therefore' },
    purpose: () => ({ stem: 'What is the notice mainly about?', answer: 'A temporary service interruption', d: [o('A change in city regulations', 'true_but_irrelevant'), o('New office hours', 'keyword_overlap'), o('A rent increase', 'reasonable_but_unstated')] }),
    detail: (v) => ({ stem: 'Why is the work being done?', answer: 'It is required by regulations.', d: [o('Tenants have complained.', 'reasonable_but_unstated'), o('The equipment is new.', 'reasonable_but_unstated'), o(`The office will move on ${v.day}.`, 'reasonable_but_unstated')] }),
    inference: () => ({ stem: 'What is suggested about the maintenance work?', answer: 'It has been carried out before.', d: [o('It will last several days.', 'opposite_meaning'), o('It was requested by tenants.', 'reasonable_but_unstated'), o('It will be done at night.', 'opposite_meaning')], why: '"required every two years" → 정기적으로 이전에도 시행됨' }),
    vocab: { word: 'Routine', answer: 'Regular', d: ['Boring', 'Exercise', 'Urgent'], why: 'routine maintenance = 정기(일상적) 점검' },
  },
  {
    id: 'service_ad',
    situation: 'marketing',
    genre: 'Advertisement',
    alts: [{ svc: 'office cleaning', unit: 'visit' }, { svc: 'document shredding', unit: 'pickup' }, { svc: 'IT support', unit: 'service call' }],
    heading: (v) => `${v.company} — Professional ${v.alt.svc.replace(/\b\w/g, (c) => c.toUpperCase())}`,
    sentences: (v) => [
      `For over ${v.n} years, ${v.company} has provided reliable ${v.alt.svc} to businesses across ${v.city}.`,
      `Our certified staff work around your schedule, including evenings and weekends.`,
      `As a result, your business never has to close while we work.`,
      `New customers who sign up before the end of ${v.month} will receive their first ${v.alt.unit} free of charge.`,
      `In addition, all contracts can be canceled at any time without a fee.`,
      `Call today to arrange a free consultation.`,
    ],
    insertIndex: 2,
    connector: { index: 4, word: 'In addition', wrong: ['Nevertheless', 'As a result', 'Instead'], why: '혜택 1(첫 방문 무료)에 혜택 2(위약금 없음)를 추가 → In addition' },
    purpose: () => ({ stem: 'What is the purpose of the advertisement?', answer: 'To attract new business customers', d: [o('To recruit certified staff', 'keyword_overlap'), o('To announce a change in schedule', 'keyword_overlap'), o('To apologize for a price increase', 'reasonable_but_unstated')] }),
    detail: (v) => ({ stem: `What will customers who sign up before the end of ${v.month} receive?`, answer: 'A free first service', d: [o('A discount on a ten-year contract', 'keyword_overlap'), o('A free product sample', 'reasonable_but_unstated'), o('Priority weekend scheduling', 'true_but_irrelevant')] }),
    inference: (v) => ({ stem: `What is suggested about ${v.company}?`, answer: 'It has been in business for many years.', d: [o('It recently opened.', 'opposite_meaning'), o('It charges a cancellation fee.', 'opposite_meaning'), o('It works only on weekdays.', 'opposite_meaning')], why: '"For over N years ... has provided" → 오랜 업력' }),
    vocab: { word: 'arrange', answer: 'schedule', d: ['organize neatly', 'compose', 'decorate'], why: 'arrange a consultation = 상담 일정을 잡다' },
  },
  {
    id: 'complaint_reply',
    situation: 'customer_service',
    genre: 'Letter',
    alts: [{ item: 'desk lamp', issue: 'arrived with a cracked base' }, { item: 'coffee grinder', issue: 'stopped working after two days' }, { item: 'office chair', issue: 'was missing two wheels' }],
    heading: (v) => `Dear ${v.R.title},`,
    sentences: (v) => [
      `Thank you for contacting us about the ${v.alt.item} you purchased on ${v.day}.`,
      `We are sorry to hear that it ${v.alt.issue}.`,
      `Unfortunately, this problem has affected a small number of units from the same shipment.`,
      `A replacement has been sent to your address and should arrive within three business days.`,
      `Meanwhile, you may keep or recycle the original item; there is no need to return it.`,
      `Sincerely, ${v.P.full}, Customer Care`,
    ],
    insertIndex: 2,
    connector: { index: 4, word: 'Meanwhile', wrong: ['Consequently', 'Otherwise', 'In short'], why: '교체품이 도착하는 동안(그 사이에) 원래 제품 처리 안내 → Meanwhile' },
    purpose: () => ({ stem: 'Why was the letter written?', answer: 'To respond to a customer complaint', d: [o('To advertise a new product', 'reasonable_but_unstated'), o('To request payment for an order', 'reasonable_but_unstated'), o('To announce a product recall', 'keyword_overlap')] }),
    detail: () => ({ stem: 'What is the customer told to do with the original item?', answer: 'Keep it or recycle it', d: [o('Return it by mail', 'opposite_meaning'), o('Bring it to a store', 'reasonable_but_unstated'), o('Send a photograph of it', 'reasonable_but_unstated')] }),
    inference: () => ({ stem: 'What is suggested about the problem?', answer: 'Other customers may have experienced it.', d: [o('It was caused by the customer.', 'reasonable_but_unstated'), o('It affects every product.', 'opposite_meaning'), o('It will take weeks to fix.', 'opposite_meaning')], why: '"affected a small number of units from the same shipment" → 다른 고객도 겪었을 가능성' }),
    vocab: { word: 'affected', answer: 'influenced', d: ['pretended', 'loved', 'reported'], why: 'has affected = 영향을 미쳤다' },
  },
  {
    id: 'policy_memo',
    situation: 'hr',
    genre: 'Memo',
    alts: [{ pol: 'travel expense', form: 'expense form' }, { pol: 'overtime', form: 'overtime request' }, { pol: 'equipment purchase', form: 'purchase request' }],
    heading: (v) => `MEMO\nTo: Department managers\nFrom: ${v.P.full}, Finance`,
    sentences: (v) => [
      `Starting on ${v.month} 1, all ${v.alt.pol} approvals will be handled through our new online system.`,
      `Paper forms will no longer be accepted after that date.`,
      `This change should reduce processing times from two weeks to about three days.`,
      `Training sessions will be held on ${v.day} and ${v.day2} in Conference Room A.`,
      `However, managers who cannot attend may watch a recorded version on the company intranet.`,
      `Please make sure your team members are informed of this change.`,
    ],
    insertIndex: 1,
    connector: { index: 4, word: 'However', wrong: ['Therefore', 'Similarly', 'For instance'], why: '교육 일정 안내 → 참석하지 못하는 경우의 예외/대안 → 대조의 However' },
    purpose: () => ({ stem: 'What is the purpose of the memo?', answer: 'To announce a change in a procedure', d: [o('To schedule a job interview', 'reasonable_but_unstated'), o('To request new equipment', 'keyword_overlap'), o('To report a budget shortfall', 'reasonable_but_unstated')] }),
    detail: () => ({ stem: 'According to the memo, what will the change do?', answer: 'Shorten processing times', d: [o('Reduce the number of managers', 'reasonable_but_unstated'), o('Eliminate training sessions', 'opposite_meaning'), o('Increase travel budgets', 'keyword_overlap')] }),
    inference: () => ({ stem: 'What is suggested about the current approval process?', answer: 'It involves paper documents.', d: [o('It is already online.', 'opposite_meaning'), o('It takes about three days.', 'wrong_time'), o('It was introduced recently.', 'reasonable_but_unstated')], why: '"Paper forms will no longer be accepted" → 현재는 종이 서류 사용' }),
    vocab: { word: 'handled', answer: 'processed', d: ['touched', 'carried', 'lifted'], why: 'approvals will be handled = 처리될 것이다' },
  },
];
