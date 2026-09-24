/**
 * Part 3 conversation grammar.
 *
 * A conversation = goal (why A starts talking) × instance (situation-specific
 * entity) × complication × intent line × next action. The reasoning path of a
 * set is goal|complication|intent|next, so novelty is enforced on *what the
 * learner has to infer*, not just on wording.
 *
 * Opening tiers control gist difficulty:
 *   1 = purpose stated explicitly, 2 = purpose must be inferred from context,
 *   3 = purpose emerges only after an unrelated-sounding detail.
 */
import type { DistractorType, Situation } from '../../domain/types';
import type { Person } from '../lexicon';

export interface Inst {
  sit: Situation;
  /** noun phrase from A's point of view: "my room reservation" */
  mine: string;
  /** generic noun for answers: "a reservation" */
  gen: string;
  /** short noun: "the reservation" */
  the: string;
  roleA: string; // "A hotel guest"
  roleB: string; // "A hotel receptionist"
  place: string; // "At a hotel"
  /** compatibility tag: complications/intents may restrict to some kinds */
  kind?: string;
  extra?: Record<string, string>;
}

export interface CV {
  A: Person;
  B: Person;
  inst: Inst;
  day: string;
  day2: string;
  day3: string;
  time: string;
  time2: string;
  city: string;
  company: string;
  dept: string;
  n: string;
  third: Person; // a third person mentioned (manager, colleague)
}

export interface Opt {
  text: string;
  type: DistractorType;
}

export interface Intent {
  id: string;
  kinds?: string[];
  speaker: 'A' | 'B';
  line: (v: CV) => string;
  /** "Why does the man say ..." — function of the line */
  why: (v: CV) => string;
  whyD: (v: CV) => Opt[];
  /** "What does the man imply ..." — implied content */
  implies: (v: CV) => string;
  impliesD: (v: CV) => Opt[];
  reply: (v: CV) => string;
  /** 1 = fairly direct, 3 = highly indirect */
  indirect: 1 | 2 | 3;
  next: NextAct[];
}

export interface NextAct {
  id: string;
  speaker: 'A' | 'B';
  line: (v: CV) => string;
  answer: (v: CV) => string;
  d: (v: CV) => Opt[];
}

export interface Complication {
  id: string;
  kinds?: string[];
  bLine: (v: CV) => string;
  /** A's reaction; omitted when the intent line is spoken by A */
  aReact: (v: CV) => string;
  problem: (v: CV) => string;
  problemD: (v: CV) => Opt[];
  intents: Intent[];
}

export interface Goal {
  id: string;
  isCall: boolean;
  instances: Inst[];
  opening: Record<1 | 2 | 3, ((v: CV) => string)[]>;
  bReply: ((v: CV) => string)[];
  aDetail: (v: CV) => string;
  detailQ: (v: CV) => { stem: string; answer: string; d: Opt[] };
  purpose: (v: CV) => string;
  purposeD: (v: CV) => Opt[];
  topic: (v: CV) => string;
  topicD: (v: CV) => Opt[];
  comps: Complication[];
}

export const man = (p: Person) => (p.gender === 'M' ? 'man' : 'woman');
export const he = (p: Person) => (p.gender === 'M' ? 'he' : 'she');
export const He = (p: Person) => (p.gender === 'M' ? 'He' : 'She');
export const him = (p: Person) => (p.gender === 'M' ? 'him' : 'her');
export const his = (p: Person) => (p.gender === 'M' ? 'his' : 'her');
const o = (text: string, type: DistractorType): Opt => ({ text, type });

// ===========================================================================
// 1. Change a booking
// ===========================================================================
const changeBooking: Goal = {
  id: 'reschedule',
  isCall: true,
  instances: [
    { sit: 'hotel', mine: 'my room reservation', gen: 'a reservation', the: 'the reservation', roleA: 'A hotel guest', roleB: 'A hotel receptionist', place: 'At a hotel' },
    { sit: 'restaurant', mine: 'our dinner reservation for eight people', gen: 'a reservation', the: 'the reservation', roleA: 'A restaurant customer', roleB: 'A restaurant host', place: 'At a restaurant' },
    { sit: 'real_estate', mine: 'the apartment viewing', gen: 'a property viewing', the: 'the viewing', roleA: 'A prospective tenant', roleB: 'A real estate agent', place: 'At a real estate agency' },
    { sit: 'maintenance', mine: "the technician's visit to service our heating system", gen: 'a service appointment', the: 'the visit', roleA: 'A homeowner', roleB: 'A repair service coordinator', place: 'At a repair company' },
    { sit: 'banking', mine: 'my appointment with a loan officer', gen: 'an appointment', the: 'the appointment', roleA: 'A bank customer', roleB: 'A bank employee', place: 'At a bank' },
    { sit: 'recruiting', mine: 'my second-round interview', gen: 'an interview', the: 'the interview', roleA: 'A job applicant', roleB: 'A recruiter', place: 'At a recruiting firm', kind: 'nofee' },
    { sit: 'events', mine: 'our tour of the banquet hall', gen: 'a venue tour', the: 'the tour', roleA: 'An event planner', roleB: 'A venue coordinator', place: 'At an event venue' },
  ],
  opening: {
    1: [(v) => `Hi, this is ${v.A.full}. I'm calling because I need to reschedule ${v.inst.mine}.`, (v) => `Hello, I'd like to change the date of ${v.inst.mine}, please.`],
    2: [
      (v) => `Hello, this is ${v.A.full}. I have ${v.inst.mine} set for ${v.day}, but my manager just asked me to fly to ${v.city} that day for a client meeting.`,
      (v) => `Hi, it's ${v.A.full}. Something's come up at work on ${v.day}, and that's the day of ${v.inst.mine}.`,
    ],
    3: [
      (v) => `Hi, ${v.A.full} here. I've just been looking at next week, and it turns out I'll be in ${v.city} from ${v.day} until the weekend. I think ${v.inst.mine} falls on one of those days.`,
      (v) => `Good morning. My company has moved our annual retreat to ${v.day} at the last minute, and, well, I believe ${v.inst.mine} is that same afternoon.`,
    ],
  },
  bReply: [(v) => `Of course, ${v.A.title}. Let me pull that up for you.`, () => "Certainly. Let me take a look at the schedule."],
  aDetail: (v) => `It's under ${v.A.full}, for ${v.time} on ${v.day}. Would it be possible to move it to ${v.day2}?`,
  detailQ: (v) => ({
    stem: `What day does the ${man(v.A)} want to change to?`,
    answer: v.day2,
    d: [o(v.day, 'wrong_time'), o(v.day3, 'wrong_time'), o('The following month', 'reasonable_but_unstated')],
  }),
  purpose: (v) => `To reschedule ${v.inst.gen}`,
  purposeD: (v) => [
    o(`To confirm ${v.inst.gen}`, 'keyword_overlap'),
    o(`To cancel ${v.inst.gen}`, 'reasonable_but_unstated'),
    o(`To arrange travel to ${v.city}`, 'true_but_irrelevant'),
    o('To ask about a billing error', 'reasonable_but_unstated'),
  ],
  topic: (v) => `Changing ${v.inst.gen}`,
  topicD: (v) => [o(`Planning a business trip to ${v.city}`, 'true_but_irrelevant'), o('A complaint about customer service', 'reasonable_but_unstated'), o(`Booking ${v.inst.gen} for a colleague`, 'wrong_person')],
  comps: [
    {
      id: 'full',
      bLine: (v) => `Let me see... I'm afraid ${v.day2} is completely booked.`,
      aReact: (v) => `Oh, that's a shame. ${v.day2} is really the only day that works for me.`,
      problem: (v) => `The requested day is unavailable.`,
      problemD: (v) => [o('The price has increased.', 'reasonable_but_unstated'), o('The booking cannot be found.', 'reasonable_but_unstated'), o(`The ${man(v.A)} is traveling on ${v.day2}.`, 'wrong_time')],
      intents: [
        {
          id: 'cancellations',
          speaker: 'B',
          line: () => 'We do get cancellations fairly often, though.',
          why: () => 'To suggest that a spot may still open up',
          whyD: () => [o('To complain about unreliable customers', 'literal_interpretation'), o('To explain why the schedule is full', 'reasonable_but_unstated'), o('To ask the listener to cancel the booking', 'opposite_meaning')],
          implies: (v) => `A ${v.day2} opening might become available.`,
          impliesD: (v) => [o(`${v.inst.the.charAt(0).toUpperCase() + v.inst.the.slice(1)} has been canceled.`, 'keyword_overlap'), o('Customers often forget their appointments.', 'literal_interpretation'), o(`Nothing will be available on ${v.day2}.`, 'opposite_meaning')],
          reply: () => 'In that case, could you put me on a waiting list?',
          indirect: 2,
          next: [
            { id: 'call_back', speaker: 'B', line: () => "Sure. I'll call you the moment something opens up.", answer: (v) => `Contact the ${man(v.A)} if a slot becomes available`, d: (v) => [o(`Cancel the ${man(v.A)}'s booking`, 'opposite_meaning'), o('Send a revised invoice', 'reasonable_but_unstated'), o(`Book a flight to ${v.city}`, 'true_but_irrelevant')] },
            { id: 'text_update', speaker: 'B', line: () => "Done. You'll get a text message automatically if anyone cancels.", answer: (v) => `The ${man(v.A)} will receive a notification if there is a cancellation`, d: () => [o('A manager will call back within an hour', 'reasonable_but_unstated'), o('The booking will be moved automatically', 'reasonable_but_unstated'), o('A fee will be charged', 'reasonable_but_unstated')] },
          ],
        },
        {
          id: 'next_morning',
          speaker: 'B',
          line: (v) => `${v.day3} morning is wide open, and that's only a day later.`,
          why: () => 'To propose an alternative time',
          whyD: (v) => [o(`To point out that ${v.day3} is less busy in general`, 'literal_interpretation'), o('To correct a scheduling error', 'reasonable_but_unstated'), o(`To say that ${v.day2} is also available`, 'opposite_meaning')],
          implies: (v) => `The ${man(v.A)} could come on ${v.day3} instead.`,
          impliesD: (v) => [o(`${v.day3} is fully booked.`, 'opposite_meaning'), o(`The ${man(v.B)} will be off work on ${v.day2}.`, 'reasonable_but_unstated'), o('Morning appointments cost less.', 'reasonable_but_unstated')],
          reply: () => "Hmm, I'd have to leave straight from the airport, but I think I can manage that.",
          indirect: 1,
          next: [
            { id: 'confirm_email', speaker: 'B', line: () => "Great. I'll switch it over and e-mail you a confirmation now.", answer: () => 'Send a confirmation e-mail', d: () => [o('Refund a deposit', 'reasonable_but_unstated'), o('Arrange airport transportation', 'keyword_overlap'), o('Transfer the call to a manager', 'reasonable_but_unstated')] },
          ],
        },
      ],
    },
    {
      id: 'fee',
      kinds: ['default'],
      bLine: () => "I can do that, but changes made less than 48 hours in advance carry a thirty-dollar fee.",
      aReact: () => "Oh, I wasn't aware of that policy.",
      problem: () => 'A charge applies to late changes.',
      problemD: () => [o('The system is not working.', 'reasonable_but_unstated'), o('No staff are available that week.', 'reasonable_but_unstated'), o('The booking was made under the wrong name.', 'reasonable_but_unstated')],
      intents: [
        {
          id: 'loyal_customer',
          speaker: 'B',
          line: (v) => `That said, I can see you've been with us for over ${v.n} years.`,
          why: () => 'To suggest that the fee might be waived',
          whyD: () => [o('To confirm the length of a contract', 'literal_interpretation'), o('To explain why the fee is necessary', 'opposite_meaning'), o('To offer a long-term membership', 'keyword_overlap')],
          implies: () => 'An exception to the policy may be possible.',
          impliesD: () => [o('The policy was introduced years ago.', 'literal_interpretation'), o('The fee will be doubled.', 'opposite_meaning'), o('The customer must renew a membership.', 'reasonable_but_unstated')],
          reply: () => "So... is there any chance you could make an exception this time?",
          indirect: 3,
          next: [
            { id: 'ask_supervisor', speaker: 'B', line: () => 'Let me just check with my supervisor. Can you hold for a moment?', answer: () => 'Speak with a supervisor', d: () => [o('Process a refund', 'reasonable_but_unstated'), o('Cancel the booking', 'opposite_meaning'), o('E-mail a copy of the policy', 'reasonable_but_unstated')] },
          ],
        },
        {
          id: 'storm',
          speaker: 'A',
          line: (v) => `Well, the weather service is predicting a major storm on ${v.day}.`,
          why: () => 'To suggest that the change is not his or her fault',
          whyD: () => [o('To recommend a different form of travel', 'reasonable_but_unstated'), o('To ask for a weather update', 'literal_interpretation'), o('To explain why the business will close', 'reasonable_but_unstated')],
          implies: () => 'The fee should not apply in this situation.',
          impliesD: (v) => [o(`${v.day} will be a busy day.`, 'reasonable_but_unstated'), o('The weather report is often wrong.', 'literal_interpretation'), o('The speaker is happy to pay the fee.', 'opposite_meaning')],
          reply: () => "Ah, you're right — weather-related changes are exempt. I'll note that on your file.",
          indirect: 2,
          next: [
            { id: 'note_file', speaker: 'B', line: () => "I'll move it to the new date and send you the details by e-mail.", answer: () => 'Send updated booking details', d: () => [o('Charge the change fee', 'opposite_meaning'), o('Call back after the storm', 'reasonable_but_unstated'), o('Recommend another location', 'reasonable_but_unstated')] },
          ],
        },
      ],
    },
    {
      id: 'system_down',
      bLine: () => "Our booking system is down this morning, so I can't make any changes right now.",
      aReact: () => '',
      problem: () => 'A computer system is not working.',
      problemD: () => [o('The staff member is new.', 'reasonable_but_unstated'), o('The office is closing early.', 'reasonable_but_unstated'), o('The phone line is unclear.', 'keyword_overlap')],
      intents: [
        {
          id: 'airport_hour',
          speaker: 'A',
          line: () => "I'm leaving for the airport in an hour.",
          why: () => 'To indicate that the matter is urgent',
          whyD: () => [o('To ask for directions to the airport', 'literal_interpretation'), o('To request a ride', 'reasonable_but_unstated'), o('To explain why he or she was late', 'reasonable_but_unstated')],
          implies: () => 'The speaker may not be reachable later.',
          impliesD: () => [o('The speaker has missed a flight.', 'reasonable_but_unstated'), o('The speaker works at the airport.', 'keyword_overlap'), o('The speaker can wait until tomorrow.', 'opposite_meaning')],
          reply: () => "Understood. I'll make the change myself as soon as the system is back up.",
          indirect: 2,
          next: [
            { id: 'email_later', speaker: 'B', line: () => "You'll have a confirmation e-mail before you land.", answer: (v) => `The ${man(v.B)} will send a confirmation later`, d: (v) => [o(`The ${man(v.A)} will call back tomorrow`, 'wrong_person'), o(`The ${man(v.A)} will go to the office in person`, 'reasonable_but_unstated'), o('The booking will be canceled', 'opposite_meaning')] },
          ],
        },
      ],
    },
  ],
};

// ===========================================================================
// 2. Check on a delayed order / request
// ===========================================================================
const orderStatus: Goal = {
  id: 'order_status',
  isCall: true,
  instances: [
    { sit: 'shipping', mine: 'the order of packaging materials we placed last week', gen: 'an order', the: 'the order', roleA: 'A business owner', roleB: 'A shipping company representative', place: 'At a shipping company', kind: 'intl' },
    { sit: 'retail', mine: 'the sofa I ordered from your store', gen: 'a purchase', the: 'the delivery', roleA: 'A customer', roleB: 'A store employee', place: 'At a furniture store' },
    { sit: 'office', mine: 'the business cards we ordered for our new staff', gen: 'a print order', the: 'the order', roleA: 'An office manager', roleB: 'A print shop employee', place: 'At a print shop' },
    { sit: 'manufacturing', mine: 'the replacement parts for our assembly line', gen: 'a parts order', the: 'the parts', roleA: 'A factory supervisor', roleB: 'A supplier', place: 'At a parts supplier', kind: 'intl' },
    { sit: 'technology', mine: 'the laptops we ordered for the new hires', gen: 'an equipment order', the: 'the laptops', roleA: 'An IT manager', roleB: 'A sales representative', place: 'At an electronics distributor', kind: 'intl' },
  ],
  opening: {
    1: [(v) => `Hi, I'm calling to find out what's happening with ${v.inst.mine}.`, (v) => `Hello, I'm checking on the status of ${v.inst.mine}.`],
    2: [(v) => `Hello, this is ${v.A.full} from ${v.company}. The tracking page for ${v.inst.mine} has said "processing" since ${v.day}.`, (v) => `Hi. We were told ${v.inst.mine} would arrive by ${v.day}, and we still haven't seen anything.`],
    3: [(v) => `Hi, it's ${v.A.full} from ${v.company}. We're opening our new location in ${v.city} next week, and, well, I'm looking at an empty storeroom. It's about ${v.inst.mine}.`, (v) => `Good afternoon. I've got ${v.n} new staff members starting on ${v.day}, and I'm starting to get a little nervous about ${v.inst.mine}.`],
  },
  bReply: [(v) => `I'm sorry to hear that, ${v.A.title}. Do you have your order number?`, () => "Let me look into that for you. Could I have the reference number?"],
  aDetail: (v) => `Yes, it's C-${Math.abs(v.A.last.length * 1371) % 9000 + 1000}. It was supposed to arrive on ${v.day}.`,
  detailQ: (v) => ({
    stem: `When was the ${v.inst.gen.replace(/^an? /, '')} expected to arrive?`,
    answer: `On ${v.day}`,
    d: [o(`On ${v.day2}`, 'wrong_time'), o('Next month', 'reasonable_but_unstated'), o('This morning', 'reasonable_but_unstated')],
  }),
  purpose: (v) => `To check on the status of ${v.inst.gen}`,
  purposeD: (v) => [o(`To place ${v.inst.gen}`, 'keyword_overlap'), o('To complain about a product defect', 'reasonable_but_unstated'), o(`To announce the opening of a store in ${v.city}`, 'true_but_irrelevant'), o('To change a delivery address', 'reasonable_but_unstated')],
  topic: (v) => `A delayed ${v.inst.gen.replace(/^an? /, '')}`,
  topicD: (v) => [o(`A new location in ${v.city}`, 'true_but_irrelevant'), o('A hiring plan', 'true_but_irrelevant'), o('A product recall', 'reasonable_but_unstated')],
  comps: [
    {
      id: 'supplier_delay',
      bLine: () => "I see it here. It looks like our supplier ran short, so it's still at our warehouse.",
      aReact: () => "That's not what I wanted to hear.",
      problem: () => 'There was a shortage at a supplier.',
      problemD: () => [o('The order was sent to the wrong address.', 'reasonable_but_unstated'), o('The warehouse has closed down.', 'keyword_overlap'), o('The payment was declined.', 'reasonable_but_unstated')],
      intents: [
        {
          id: 'partial',
          speaker: 'B',
          line: () => 'Part of it is ready to go, though.',
          why: () => 'To offer to send a partial shipment',
          whyD: () => [o('To apologize for a packing mistake', 'reasonable_but_unstated'), o('To report that the entire order is ready', 'opposite_meaning'), o('To explain how the items are packaged', 'literal_interpretation')],
          implies: () => 'Some of the items could be shipped now.',
          impliesD: () => [o('The whole order has been canceled.', 'opposite_meaning'), o('The items were damaged.', 'reasonable_but_unstated'), o('The warehouse is ready for an inspection.', 'keyword_overlap')],
          reply: () => "Honestly, even half of it would help us get through the week.",
          indirect: 2,
          next: [
            { id: 'ship_today', speaker: 'B', line: () => "Then I'll have those items sent out by express courier this afternoon, at no extra charge.", answer: () => 'Arrange an express shipment', d: () => [o('Issue a full refund', 'reasonable_but_unstated'), o('Contact a different supplier', 'reasonable_but_unstated'), o('Visit the store in person', 'reasonable_but_unstated')] },
          ],
        },
        {
          id: 'competitor',
          speaker: 'A',
          line: () => 'Another supplier told me they could deliver by tomorrow.',
          why: () => 'To put pressure on the listener to act quickly',
          whyD: () => [o('To recommend a different company', 'literal_interpretation'), o('To confirm a delivery date', 'keyword_overlap'), o('To ask for the other supplier\'s phone number', 'reasonable_but_unstated')],
          implies: () => 'The speaker may cancel the order.',
          impliesD: () => [o('The speaker works for a competitor.', 'reasonable_but_unstated'), o('The order will arrive tomorrow.', 'keyword_overlap'), o('The speaker is satisfied with the service.', 'opposite_meaning')],
          reply: () => "I understand. Let me see what I can do before you make that decision.",
          indirect: 3,
          next: [
            { id: 'manager_call', speaker: 'B', line: () => "I'm going to speak to our warehouse manager right now and call you back within the hour.", answer: () => 'Talk to a warehouse manager', d: () => [o('Cancel the order', 'opposite_meaning'), o('E-mail a discount code', 'reasonable_but_unstated'), o('Check the tracking page', 'keyword_overlap')] },
          ],
        },
      ],
    },
    {
      id: 'wrong_address',
      bLine: () => "Oh, I see the problem. It was sent to the address on your old account.",
      aReact: () => "We moved out of that building months ago.",
      problem: () => 'An order was shipped to an outdated address.',
      problemD: () => [o('The package was damaged in transit.', 'reasonable_but_unstated'), o('The account was closed.', 'keyword_overlap'), o('The items were out of stock.', 'reasonable_but_unstated')],
      intents: [
        {
          id: 'building_manager',
          speaker: 'A',
          line: () => "The building manager there still forwards our mail, though.",
          why: () => 'To suggest that the package can probably be recovered',
          whyD: () => [o('To complain about the building manager', 'literal_interpretation'), o('To ask for the building manager\'s address', 'reasonable_but_unstated'), o('To explain why the company moved', 'reasonable_but_unstated')],
          implies: () => 'The package may not be lost.',
          impliesD: () => [o('The package has already been returned.', 'reasonable_but_unstated'), o('The speaker still works in the old building.', 'keyword_overlap'), o('The package cannot be found.', 'opposite_meaning')],
          reply: () => "That's good news. Then it's probably just a matter of a day or two.",
          indirect: 2,
          next: [
            { id: 'update_address', speaker: 'B', line: () => "In the meantime, I'll update the address on your account so this doesn't happen again.", answer: () => 'Update account information', d: () => [o('Send a replacement order', 'reasonable_but_unstated'), o('Call the building manager', 'wrong_person'), o('Issue a refund', 'reasonable_but_unstated')] },
            { id: 'call_building', speaker: 'A', line: () => "I'll give the building manager a call right now and ask about it.", answer: (v) => `The ${man(v.A)} will call a building manager`, d: (v) => [o(`The ${man(v.B)} will send a new shipment`, 'wrong_person'), o(`The ${man(v.A)} will visit the warehouse`, 'reasonable_but_unstated'), o(`The ${man(v.A)} will cancel the order`, 'opposite_meaning')] },
          ],
        },
      ],
    },
    {
      id: 'customs',
      kinds: ['intl'],
      bLine: () => "It's being held at customs. Some paperwork is missing from the shipment.",
      aReact: () => "Is there anything I can do to speed things up?",
      problem: () => 'Some documents are missing.',
      problemD: () => [o('A customs officer is on vacation.', 'reasonable_but_unstated'), o('The shipping fee was not paid.', 'reasonable_but_unstated'), o('The items are too heavy to ship.', 'reasonable_but_unstated')],
      intents: [
        {
          id: 'broker',
          speaker: 'B',
          line: () => "Some of our customers use a customs broker for exactly this reason.",
          why: () => 'To recommend a service',
          whyD: () => [o('To explain the company\'s shipping policy', 'reasonable_but_unstated'), o('To describe a typical customer', 'literal_interpretation'), o('To say that the problem cannot be solved', 'opposite_meaning')],
          implies: () => 'Hiring a specialist could solve the problem faster.',
          impliesD: () => [o('Most customers experience delays.', 'literal_interpretation'), o('The shipment will be returned.', 'reasonable_but_unstated'), o('The company has stopped international shipping.', 'reasonable_but_unstated')],
          reply: () => "I didn't know that was an option. Do you have anyone you'd suggest?",
          indirect: 2,
          next: [
            { id: 'send_list', speaker: 'B', line: () => "I'll e-mail you a list of brokers we've worked with.", answer: () => 'Send a list of contacts', d: () => [o('Fill out a customs form', 'keyword_overlap'), o('Refund the shipping cost', 'reasonable_but_unstated'), o('Call a customs office', 'reasonable_but_unstated')] },
          ],
        },
      ],
    },
  ],
};

// ===========================================================================
// 3. Report an equipment problem
// ===========================================================================
const equipmentProblem: Goal = {
  id: 'equipment',
  isCall: false,
  instances: [
    { sit: 'office', mine: 'the copier on the fourth floor', gen: 'a copier', the: 'the copier', roleA: 'An office worker', roleB: 'A facilities manager', place: 'In an office', kind: 'shared' },
    { sit: 'maintenance', mine: 'the freight elevator in the warehouse', gen: 'an elevator', the: 'the elevator', roleA: 'A warehouse worker', roleB: 'A maintenance supervisor', place: 'At a warehouse' },
    { sit: 'manufacturing', mine: 'the labeling machine on line three', gen: 'a machine', the: 'the machine', roleA: 'A factory worker', roleB: 'A maintenance supervisor', place: 'At a factory' },
    { sit: 'restaurant', mine: 'the dishwasher in the kitchen', gen: 'a kitchen appliance', the: 'the dishwasher', roleA: 'A cook', roleB: 'A restaurant manager', place: 'At a restaurant' },
    { sit: 'meeting', mine: 'the video conferencing system in the boardroom', gen: 'a video conferencing system', the: 'the system', roleA: 'A manager', roleB: 'An IT technician', place: 'In an office building', kind: 'shared' },
  ],
  opening: {
    1: [(v) => `Hi, I need to report a problem with ${v.inst.mine}. It stopped working this morning.`, (v) => `Excuse me, ${v.inst.mine} isn't working, and I was told to let you know.`],
    2: [(v) => `Hi. So, ${v.inst.mine} started making a strange noise this morning, and now it won't turn on at all.`, (v) => `Hello. I've tried restarting ${v.inst.mine} three times, and I keep getting the same error message.`],
    3: [(v) => `Hi, do you have a minute? We've got a big order due at ${v.time}, and ${v.inst.mine} picked today of all days to act up.`, (v) => `Morning. I don't want to make a fuss, but I've been standing next to ${v.inst.mine} for twenty minutes, and nothing's happened.`],
  },
  bReply: [(v) => `Oh no. Thanks for letting me know, ${v.A.first}. When did it start?`, () => "I'm sorry about that. What exactly is it doing?"],
  aDetail: (v) => `It was fine yesterday, but around ${v.time} today it just shut off. There's a red light blinking on the side.`,
  detailQ: (v) => ({
    stem: `What does the ${man(v.A)} say about the equipment?`,
    answer: 'A warning light is flashing.',
    d: [o('It was installed yesterday.', 'wrong_time'), o('It is making a loud noise.', 'reasonable_but_unstated'), o('It is out of paper.', 'reasonable_but_unstated')],
  }),
  purpose: (v) => `To report a problem with ${v.inst.gen}`,
  purposeD: (v) => [o(`To request a new ${v.inst.gen.replace(/^an? /, '')}`, 'keyword_overlap'), o('To ask about a large order', 'true_but_irrelevant'), o('To complain about a coworker', 'reasonable_but_unstated'), o('To ask for training', 'reasonable_but_unstated')],
  topic: (v) => `A malfunctioning ${v.inst.gen.replace(/^an? /, '')}`,
  topicD: () => [o('A large order', 'true_but_irrelevant'), o('An office relocation', 'reasonable_but_unstated'), o('A budget request', 'reasonable_but_unstated')],
  comps: [
    {
      id: 'tech_busy',
      bLine: () => "The technician is at our other site all day, unfortunately.",
      aReact: () => "Is there no one else who can take a look?",
      problem: () => 'A repair person is unavailable today.',
      problemD: () => [o('A replacement part is too expensive.', 'reasonable_but_unstated'), o('The warranty has expired.', 'reasonable_but_unstated'), o('The site is closed for the day.', 'keyword_overlap')],
      intents: [
        {
          id: 'manual',
          speaker: 'B',
          line: () => "The manual is in the top drawer, if you're feeling brave.",
          why: () => 'To suggest that the listener try to fix it',
          whyD: () => [o('To say where some documents are stored', 'literal_interpretation'), o('To warn that the equipment is dangerous', 'keyword_overlap'), o('To refuse to help', 'opposite_meaning')],
          implies: () => 'The problem might be simple enough to fix without a technician.',
          impliesD: () => [o('The equipment must be replaced.', 'opposite_meaning'), o('The manual is missing.', 'reasonable_but_unstated'), o('The drawer is locked.', 'keyword_overlap')],
          reply: () => "Ha — I'll give it a try, but no promises.",
          indirect: 3,
          next: [
            { id: 'try_fix', speaker: 'A', line: () => "Let me grab it now, before things get busy.", answer: (v) => `The ${man(v.A)} will look at a manual`, d: (v) => [o(`The ${man(v.A)} will call the technician`, 'reasonable_but_unstated'), o(`The ${man(v.B)} will order a new part`, 'wrong_person'), o(`The ${man(v.A)} will cancel a meeting`, 'reasonable_but_unstated')] },
          ],
        },
        {
          id: 'third_floor',
          kinds: ['shared'],
          speaker: 'B',
          line: () => "The one on the third floor was serviced just last week.",
          why: () => 'To recommend using different equipment',
          whyD: () => [o('To explain when repairs are usually done', 'literal_interpretation'), o('To complain about the service company', 'reasonable_but_unstated'), o('To ask the listener to move to another floor permanently', 'reasonable_but_unstated')],
          implies: () => 'Another unit nearby should work properly.',
          impliesD: () => [o('The third floor is closed.', 'reasonable_but_unstated'), o('All the units need servicing.', 'opposite_meaning'), o('The service was very expensive.', 'reasonable_but_unstated')],
          reply: () => "Good point. That'll do for now.",
          indirect: 2,
          next: [
            { id: 'log_request', speaker: 'B', line: () => "And I'll log a repair request so the technician comes here first thing tomorrow.", answer: () => 'Submit a repair request', d: () => [o('Replace the equipment', 'reasonable_but_unstated'), o('Deliver a large order', 'true_but_irrelevant'), o('Go to the other site', 'keyword_overlap')] },
          ],
        },
      ],
    },
    {
      id: 'part_order',
      bLine: () => "We've seen this before. It's a faulty power board, and replacements take about a week to arrive.",
      aReact: () => "A week? We really depend on it.",
      problem: () => 'A replacement part will take time to arrive.',
      problemD: () => [o('The power went out in the building.', 'keyword_overlap'), o('No one knows what is wrong.', 'opposite_meaning'), o('The equipment is brand new.', 'reasonable_but_unstated')],
      intents: [
        {
          id: 'rental',
          speaker: 'B',
          line: (v) => `${v.company} rents out units by the week, you know.`,
          why: () => 'To suggest a temporary solution',
          whyD: (v) => [o(`To explain what ${v.company} sells`, 'literal_interpretation'), o('To recommend buying a new unit', 'reasonable_but_unstated'), o('To say that the repair will be free', 'reasonable_but_unstated')],
          implies: () => 'A rental unit could be used until the repair is finished.',
          impliesD: () => [o('The company is buying a replacement.', 'reasonable_but_unstated'), o('The repair will take less than a week.', 'opposite_meaning'), o('The speaker used to work at the rental company.', 'reasonable_but_unstated')],
          reply: () => "Oh, that would be perfect if the budget allows it.",
          indirect: 2,
          next: [
            { id: 'get_quote', speaker: 'B', line: () => "I'll call them and get a price, then send it to you for approval.", answer: () => 'Get a price quote', d: () => [o('Approve a purchase', 'wrong_person'), o('Install a new power board', 'reasonable_but_unstated'), o('Move to another office', 'reasonable_but_unstated')] },
          ],
        },
      ],
    },
  ],
};

// ===========================================================================
// 4. Ask a colleague for help
// ===========================================================================
const requestHelp: Goal = {
  id: 'help',
  isCall: false,
  instances: [
    { sit: 'office', mine: 'the sales presentation for Thursday', gen: 'a presentation', the: 'the presentation', roleA: 'A sales associate', roleB: 'A coworker', place: 'In an office' },
    { sit: 'accounting', mine: 'the quarterly expense report', gen: 'a financial report', the: 'the report', roleA: 'An accountant', roleB: 'A colleague', place: 'At an accounting firm' },
    { sit: 'marketing', mine: 'the product launch campaign', gen: 'a marketing campaign', the: 'the campaign', roleA: 'A marketing specialist', roleB: 'A team member', place: 'At a marketing agency' },
    { sit: 'training', mine: 'the training manual for the new interns', gen: 'a training document', the: 'the manual', roleA: 'A trainer', roleB: 'A coworker', place: 'At a company' },
    { sit: 'contracts', mine: 'the contract for the Lisbon client', gen: 'a contract', the: 'the contract', roleA: 'A legal assistant', roleB: 'A coworker', place: 'At a law firm' },
  ],
  opening: {
    1: [(v) => `${v.B.first}, would you be able to help me with ${v.inst.mine}?`, (v) => `${v.B.first}, I need a hand with ${v.inst.mine}. Do you have some time today?`],
    2: [(v) => `${v.B.first}, have you got a minute? ${v.third.title} just moved the deadline for ${v.inst.mine} up to tomorrow.`, (v) => `${v.B.first}, I've been staring at ${v.inst.mine} all morning, and I'm only halfway through.`],
    3: [(v) => `${v.B.first}, you worked on the ${v.city} account last year, didn't you? I'm asking because ${v.third.title} just handed me ${v.inst.mine}.`, (v) => `${v.B.first}, what does your afternoon look like? I just got out of a meeting with ${v.third.title}, and, well... it's about ${v.inst.mine}.`],
  },
  bReply: [() => "Sure, what's going on?", () => "Maybe. What do you need?"],
  aDetail: (v) => `It has to be finished by ${v.time} tomorrow, and I haven't even started on the section about ${v.city}.`,
  detailQ: (v) => ({
    stem: `According to the ${man(v.A)}, which part has not been started?`,
    answer: `The section about ${v.city}`,
    d: [o('The introduction', 'reasonable_but_unstated'), o('The budget summary', 'reasonable_but_unstated'), o(`The section about ${v.third.title}`, 'wrong_person')],
  }),
  purpose: () => 'To ask for assistance with a task',
  purposeD: (v) => [o(`To complain about ${v.third.title}`, 'reasonable_but_unstated'), o(`To report on a trip to ${v.city}`, 'true_but_irrelevant'), o('To request a deadline extension', 'reasonable_but_unstated'), o('To introduce a new client', 'reasonable_but_unstated')],
  topic: (v) => `Help with ${v.inst.gen}`,
  topicD: (v) => [o(`A business trip to ${v.city}`, 'true_but_irrelevant'), o('A job promotion', 'reasonable_but_unstated'), o('A team lunch', 'reasonable_but_unstated')],
  comps: [
    {
      id: 'busy_training',
      bLine: () => "I'd like to, but I'm in a training session until three.",
      aReact: () => "Hmm. That doesn't leave a lot of time.",
      problem: (v) => `The ${man(v.B)} has another commitment.`,
      problemD: () => [o('The deadline has passed.', 'reasonable_but_unstated'), o('The training was canceled.', 'opposite_meaning'), o('Some data is missing.', 'reasonable_but_unstated')],
      intents: [
        {
          id: 'after_three',
          speaker: 'B',
          line: () => "My evening's completely free, though.",
          why: () => 'To offer to help later',
          whyD: () => [o('To suggest meeting for dinner', 'literal_interpretation'), o('To decline the request', 'opposite_meaning'), o('To complain about working late', 'reasonable_but_unstated')],
          implies: (v) => `The ${man(v.B)} is willing to stay late.`,
          impliesD: (v) => [o(`The ${man(v.B)} will leave work early.`, 'opposite_meaning'), o(`The ${man(v.B)} has no plans this week.`, 'reasonable_but_unstated'), o('The training will be rescheduled.', 'reasonable_but_unstated')],
          reply: () => "You'd do that? That would be a huge help.",
          indirect: 2,
          next: [
            { id: 'send_files', speaker: 'A', line: () => "I'll send you the files now so you can look at them during your break.", answer: (v) => `The ${man(v.A)} will send some files`, d: (v) => [o(`The ${man(v.A)} will attend a training session`, 'wrong_person'), o(`The ${man(v.B)} will call a manager`, 'reasonable_but_unstated'), o(`The ${man(v.A)} will book a meeting room`, 'reasonable_but_unstated')] },
          ],
        },
        {
          id: 'priya',
          speaker: 'B',
          line: (v) => `Have you asked ${v.third.first}? ${He(v.third)} wrote most of last year's version.`,
          why: () => 'To suggest someone more suitable',
          whyD: (v) => [o(`To find out whether ${v.third.first} is available`, 'literal_interpretation'), o(`To praise ${v.third.first}'s writing`, 'reasonable_but_unstated'), o('To ask for a copy of last year\'s version', 'keyword_overlap')],
          implies: (v) => `${v.third.first} would be a good person to help.`,
          impliesD: (v) => [o(`${v.third.first} made mistakes last year.`, 'reasonable_but_unstated'), o(`${v.third.first} is on vacation.`, 'reasonable_but_unstated'), o(`The ${man(v.B)} will do the work alone.`, 'opposite_meaning')],
          reply: () => "No, I didn't know that. Good idea.",
          indirect: 2,
          next: [
            { id: 'email_third', speaker: 'A', line: (v) => `I'll send ${v.third.first} a message right now.`, answer: (v) => `Contact ${v.third.first}`, d: () => [o('Revise last year\'s version', 'keyword_overlap'), o('Attend a training session', 'wrong_person'), o('Ask for a deadline extension', 'reasonable_but_unstated')] },
          ],
        },
      ],
    },
    {
      id: 'data_missing',
      bLine: (v) => `I can, but we still don't have the figures from the ${v.city} office, do we?`,
      aReact: () => "No. They said they'd send them yesterday.",
      problem: () => 'Some information has not been received.',
      problemD: (v) => [o(`The ${v.city} office has closed.`, 'keyword_overlap'), o('The figures contain errors.', 'reasonable_but_unstated'), o('The software is not working.', 'reasonable_but_unstated')],
      intents: [
        {
          id: 'time_zone',
          speaker: 'B',
          line: (v) => `It's only six in the morning in ${v.city}.`,
          why: () => 'To explain why there has been no response',
          whyD: (v) => [o(`To correct the time of a meeting`, 'reasonable_but_unstated'), o(`To suggest calling ${v.city} immediately`, 'opposite_meaning'), o('To mention the local time', 'literal_interpretation')],
          implies: () => 'The other office has not started work yet.',
          impliesD: () => [o('The figures were already sent.', 'reasonable_but_unstated'), o('The office opens at six.', 'literal_interpretation'), o('The deadline is too early.', 'reasonable_but_unstated')],
          reply: () => "Right, I forgot about the time difference.",
          indirect: 3,
          next: [
            { id: 'start_other', speaker: 'B', line: () => "Let's start on everything else, and I'll e-mail them before they log on.", answer: (v) => `The ${man(v.B)} will send an e-mail`, d: (v) => [o(`The ${man(v.B)} will travel to another office`, 'reasonable_but_unstated'), o(`The ${man(v.A)} will cancel the project`, 'reasonable_but_unstated'), o(`The ${man(v.B)} will call a client`, 'reasonable_but_unstated')] },
          ],
        },
      ],
    },
  ],
};

// ===========================================================================
// 5. Plan an event
// ===========================================================================
const planEvent: Goal = {
  id: 'event',
  isCall: false,
  instances: [
    { sit: 'events', mine: "the retirement party for Mr. Brennan", gen: 'a retirement party', the: 'the party', roleA: 'An office employee', roleB: 'A coworker', place: 'In an office' },
    { sit: 'conference', mine: "next month's industry conference", gen: 'a conference', the: 'the conference', roleA: 'An event organizer', roleB: 'A colleague', place: 'At a conference planning office' },
    { sit: 'restaurant', mine: 'the client appreciation dinner', gen: 'a company dinner', the: 'the dinner', roleA: 'An administrative assistant', roleB: 'A manager', place: 'In an office' },
    { sit: 'training', mine: 'the leadership workshop for new supervisors', gen: 'a workshop', the: 'the workshop', roleA: 'A human resources coordinator', roleB: 'A department manager', place: 'At a company' },
  ],
  opening: {
    1: [(v) => `${v.B.first}, I wanted to talk to you about ${v.inst.mine}. We need to decide on the catering.`, (v) => `${v.B.first}, can we go over the plans for ${v.inst.mine}?`],
    2: [(v) => `${v.B.first}, I just got a quote from Greenfield Catering for ${v.inst.mine}, and it's a lot higher than we budgeted.`, (v) => `${v.B.first}, the guest list for ${v.inst.mine} has grown to over a hundred people.`],
    3: [(v) => `${v.B.first}, remember how everyone complained about the food last year? Well, I'm working on ${v.inst.mine}.`, (v) => `${v.B.first}, I had lunch with ${v.third.title} yesterday, and ${he(v.third)} mentioned that ${v.inst.mine} might be bigger than we thought.`],
  },
  bReply: [() => "Sure. Where are we with it?", () => "Good timing — I was going to ask you about that."],
  aDetail: (v) => `It's set for ${v.day} the ${['12th', '15th', '20th', '27th'][v.A.last.length % 4]}, from ${v.time} in the main hall.`,
  detailQ: (v) => ({
    stem: 'Where will the event be held?',
    answer: 'In the main hall',
    d: [o('At a restaurant downtown', 'reasonable_but_unstated'), o(`At a hotel in ${v.city}`, 'reasonable_but_unstated'), o('In a conference room', 'keyword_overlap')],
  }),
  purpose: (v) => `To discuss plans for ${v.inst.gen}`,
  purposeD: (v) => [o('To complain about last year\'s food', 'true_but_irrelevant'), o(`To invite the ${man(v.B)} to a lunch`, 'keyword_overlap'), o('To request a larger budget for a department', 'reasonable_but_unstated'), o('To hire a new caterer permanently', 'reasonable_but_unstated')],
  topic: (v) => `Preparations for ${v.inst.gen}`,
  topicD: () => [o('A budget cut', 'reasonable_but_unstated'), o('A restaurant review', 'reasonable_but_unstated'), o('A job opening', 'reasonable_but_unstated')],
  comps: [
    {
      id: 'over_budget',
      bLine: () => "The trouble is, the catering quote came in almost twice what we'd planned.",
      aReact: () => "Really? Last year's was much cheaper.",
      problem: () => 'A cost is higher than expected.',
      problemD: () => [o('The venue is unavailable.', 'reasonable_but_unstated'), o('The caterer has closed.', 'reasonable_but_unstated'), o('Too few people have registered.', 'opposite_meaning')],
      intents: [
        {
          id: 'cafeteria',
          speaker: 'B',
          line: () => "Our cafeteria staff did a great job at the holiday lunch, didn't they?",
          why: () => 'To propose using an in-house option',
          whyD: () => [o('To praise a recent holiday event', 'literal_interpretation'), o('To ask about the holiday schedule', 'keyword_overlap'), o('To suggest canceling the event', 'reasonable_but_unstated')],
          implies: () => 'The company cafeteria could provide the food instead.',
          impliesD: () => [o('The holiday lunch was too expensive.', 'reasonable_but_unstated'), o('The cafeteria will be closed.', 'opposite_meaning'), o('The caterer also runs the cafeteria.', 'reasonable_but_unstated')],
          reply: () => "Oh, that's a thought. And it would save us the delivery fee, too.",
          indirect: 3,
          next: [
            { id: 'ask_cafeteria', speaker: 'A', line: () => "I'll stop by the cafeteria this afternoon and ask if they're available.", answer: () => 'Talk to the cafeteria staff', d: () => [o('Sign a catering contract', 'opposite_meaning'), o('Plan a holiday lunch', 'keyword_overlap'), o('Reduce the guest list', 'reasonable_but_unstated')] },
          ],
        },
        {
          id: 'fewer_guests',
          speaker: 'A',
          line: () => "Well, not everyone on the list has replied yet.",
          why: () => 'To suggest that the final cost may be lower',
          whyD: () => [o('To complain that guests are slow to reply', 'literal_interpretation'), o('To propose sending more invitations', 'opposite_meaning'), o('To explain why the list was lost', 'reasonable_but_unstated')],
          implies: () => 'Fewer people may attend than expected.',
          impliesD: () => [o('Everyone has already accepted.', 'opposite_meaning'), o('The list has been deleted.', 'reasonable_but_unstated'), o('The replies were sent to the wrong address.', 'reasonable_but_unstated')],
          reply: () => "True. Let's wait until Friday before we decide.",
          indirect: 2,
          next: [
            { id: 'reminder', speaker: 'A', line: () => "I'll send a reminder to everyone who hasn't responded.", answer: () => 'Send a reminder to guests', d: () => [o('Book a different caterer', 'reasonable_but_unstated'), o('Increase the budget', 'reasonable_but_unstated'), o('Cancel the event', 'reasonable_but_unstated')] },
          ],
        },
      ],
    },
    {
      id: 'hall_booked',
      bLine: () => "Actually, I just found out the main hall is being painted that week.",
      aReact: () => '',
      problem: () => 'The planned location will not be available.',
      problemD: () => [o('The date conflicts with a holiday.', 'reasonable_but_unstated'), o('The painters charged too much.', 'keyword_overlap'), o('The hall is too small.', 'reasonable_but_unstated')],
      intents: [
        {
          id: 'rooftop',
          speaker: 'A',
          line: () => "The weather's supposed to be lovely that week, isn't it?",
          why: () => 'To suggest holding the event outdoors',
          whyD: () => [o('To start a friendly conversation', 'literal_interpretation'), o('To ask for a weather forecast', 'literal_interpretation'), o('To recommend postponing the event', 'opposite_meaning')],
          implies: () => 'The event could take place outside.',
          impliesD: () => [o('The painting will be finished early.', 'reasonable_but_unstated'), o('Guests may not come because of rain.', 'opposite_meaning'), o('The speaker is going on vacation.', 'reasonable_but_unstated')],
          reply: () => "The rooftop terrace! Why didn't I think of that?",
          indirect: 3,
          next: [
            { id: 'reserve_terrace', speaker: 'B', line: () => "I'll call building management and reserve it before someone else does.", answer: () => 'Reserve an outdoor space', d: () => [o('Hire a painter', 'keyword_overlap'), o('Check the weather forecast', 'literal_interpretation'), o('Postpone the event', 'opposite_meaning')] },
          ],
        },
      ],
    },
  ],
};

// ===========================================================================
// 6. Customer inquiry about a product/service
// ===========================================================================
const purchaseInquiry: Goal = {
  id: 'purchase',
  isCall: false,
  instances: [
    { sit: 'retail', mine: 'the standing desk in your window display', gen: 'a desk', the: 'the desk', roleA: 'A shopper', roleB: 'A salesperson', place: 'At a furniture store', kind: 'product' },
    { sit: 'technology', mine: 'the wireless headphones on your website', gen: 'headphones', the: 'the headphones', roleA: 'A customer', roleB: 'An electronics store clerk', place: 'At an electronics store', kind: 'product' },
    { sit: 'travel', mine: 'the weekend tour to the coast', gen: 'a tour package', the: 'the tour', roleA: 'A tourist', roleB: 'A travel agent', place: 'At a travel agency' },
    { sit: 'retail', mine: 'the espresso machine in your catalog', gen: 'a coffee machine', the: 'the machine', roleA: 'A café owner', roleB: 'A salesperson', place: 'At an appliance store', kind: 'product' },
    { sit: 'airport', mine: 'the airport lounge pass', gen: 'a lounge pass', the: 'the pass', roleA: 'A traveler', roleB: 'An airline employee', place: 'At an airport' },
  ],
  opening: {
    1: [(v) => `Hi, I'd like some information about ${v.inst.mine}.`, (v) => `Excuse me, could you tell me more about ${v.inst.mine}?`],
    2: [(v) => `Hi. I saw ${v.inst.mine} last week, and I can't stop thinking about it.`, (v) => `Hello. A friend of mine recommended ${v.inst.mine}, and I have a few questions.`],
    3: [(v) => `Hi there. My company is moving to a bigger space next month, and, well, my budget is tight. Someone mentioned ${v.inst.mine}.`, (v) => `Hello. I've compared prices at three places this week, and I ended up back here looking at ${v.inst.mine}.`],
  },
  bReply: [() => "Of course. What would you like to know?", () => "Happy to help. It's been very popular this month."],
  aDetail: (v) => `Mainly the price. The one I saw was listed at ${['two hundred', 'three hundred', 'four hundred', 'five hundred'][v.A.last.length % 4]} dollars.`,
  detailQ: (v) => ({
    stem: `What is the ${man(v.A)} mainly concerned about?`,
    answer: 'The cost',
    d: [o('The size', 'reasonable_but_unstated'), o('The delivery date', 'reasonable_but_unstated'), o('The color', 'reasonable_but_unstated')],
  }),
  purpose: (v) => `To ask about ${v.inst.gen}`,
  purposeD: (v) => [o(`To return ${v.inst.gen}`, 'reasonable_but_unstated'), o('To apply for a job', 'reasonable_but_unstated'), o('To complain about a price increase', 'keyword_overlap'), o('To move to a new office', 'true_but_irrelevant')],
  topic: (v) => `Purchasing ${v.inst.gen}`,
  topicD: () => [o('Moving to a new city', 'true_but_irrelevant'), o('A product defect', 'reasonable_but_unstated'), o('A job interview', 'reasonable_but_unstated')],
  comps: [
    {
      id: 'price_up',
      bLine: () => "That was the sale price. It went back up to the regular price on Monday.",
      aReact: () => "Oh no. I was really hoping to get it at that price.",
      problem: () => 'A discount has ended.',
      problemD: () => [o('The item is out of stock.', 'reasonable_but_unstated'), o('The price was printed incorrectly.', 'reasonable_but_unstated'), o('The store is closing.', 'reasonable_but_unstated')],
      intents: [
        {
          id: 'members',
          speaker: 'B',
          line: () => "Members still get fifteen percent off everything, and signing up only takes a minute.",
          why: () => 'To suggest a way to reduce the cost',
          whyD: () => [o('To explain the store\'s return policy', 'reasonable_but_unstated'), o('To say that the sale has been extended', 'opposite_meaning'), o('To describe how long a process takes', 'literal_interpretation')],
          implies: (v) => `The ${man(v.A)} could get a discount by joining a program.`,
          impliesD: () => [o('The item is only available to members.', 'keyword_overlap'), o('The price will rise again.', 'reasonable_but_unstated'), o('Membership is expensive.', 'opposite_meaning')],
          reply: () => "Really? Then I'll sign up.",
          indirect: 1,
          next: [
            { id: 'fill_form', speaker: 'B', line: () => "Great. I'll just need you to fill out this short form.", answer: (v) => `The ${man(v.A)} will complete a form`, d: (v) => [o(`The ${man(v.A)} will come back next week`, 'reasonable_but_unstated'), o(`The ${man(v.B)} will call a manager`, 'reasonable_but_unstated'), o(`The ${man(v.A)} will pay the full price`, 'opposite_meaning')] },
          ],
        },
        {
          id: 'floor_model',
          kinds: ['product'],
          speaker: 'B',
          line: () => "Of course, the display model has a tiny scratch on the side.",
          why: () => 'To hint that a cheaper option is available',
          whyD: () => [o('To warn the customer about poor quality', 'literal_interpretation'), o('To apologize for damaged goods', 'reasonable_but_unstated'), o('To explain why the display was removed', 'reasonable_but_unstated')],
          implies: () => 'The display model could be sold at a lower price.',
          impliesD: () => [o('All the products are damaged.', 'reasonable_but_unstated'), o('The display model is not for sale.', 'opposite_meaning'), o('The item will be repaired next week.', 'reasonable_but_unstated')],
          reply: () => "Would you take a bit off the price for that one?",
          indirect: 3,
          next: [
            { id: 'check_manager', speaker: 'B', line: () => "Let me ask my manager what we can do.", answer: () => 'Consult a manager', d: () => [o('Repair a scratch', 'literal_interpretation'), o('Order a new item', 'reasonable_but_unstated'), o('Process a refund', 'reasonable_but_unstated')] },
          ],
        },
      ],
    },
    {
      id: 'sold_out',
      kinds: ['product'],
      bLine: (v) => `I'm sorry, we sold the last one on ${v.day}.`,
      aReact: () => "That's too bad. I really needed one this week.",
      problem: () => 'An item is not currently available.',
      problemD: () => [o('The price has gone up.', 'reasonable_but_unstated'), o('The item was recalled.', 'reasonable_but_unstated'), o('The store stopped selling the brand.', 'reasonable_but_unstated')],
      intents: [
        {
          id: 'other_branch',
          speaker: 'B',
          line: () => "Our Riverside branch usually has a few in the back, though.",
          why: () => 'To suggest checking another location',
          whyD: () => [o('To describe the Riverside branch', 'literal_interpretation'), o('To explain where products are stored', 'literal_interpretation'), o('To say the item is sold out everywhere', 'opposite_meaning')],
          implies: () => 'The item may be available at another store.',
          impliesD: () => [o('The Riverside branch is closing.', 'reasonable_but_unstated'), o('The item is kept in the back of this store.', 'keyword_overlap'), o('No stores have the item.', 'opposite_meaning')],
          reply: () => "Oh, that's not far from my office.",
          indirect: 2,
          next: [
            { id: 'call_branch', speaker: 'B', line: () => "Let me call them and ask them to hold one for you.", answer: () => 'Call another store', d: () => [o('Place an online order', 'reasonable_but_unstated'), o('Give a refund', 'reasonable_but_unstated'), o('Drive to the office', 'keyword_overlap')] },
          ],
        },
      ],
    },
  ],
};

// ===========================================================================
// 7. Project update / client feedback
// ===========================================================================
const projectUpdate: Goal = {
  id: 'project',
  isCall: false,
  instances: [
    { sit: 'marketing', mine: 'the new advertising campaign', gen: 'an advertising campaign', the: 'the campaign', roleA: 'An advertising executive', roleB: 'A graphic designer', place: 'At an advertising agency' },
    { sit: 'technology', mine: 'the mobile app redesign', gen: 'a software project', the: 'the app', roleA: 'A project manager', roleB: 'A software developer', place: 'At a software company' },
    { sit: 'manufacturing', mine: 'the new packaging line', gen: 'a production change', the: 'the packaging line', roleA: 'A plant manager', roleB: 'A production engineer', place: 'At a factory' },
    { sit: 'real_estate', mine: 'the renovation of the Harbor Road building', gen: 'a renovation project', the: 'the renovation', roleA: 'A property developer', roleB: 'An architect', place: 'At an architecture firm' },
    { sit: 'accounting', mine: 'the audit for Veridian Foods', gen: 'an audit', the: 'the audit', roleA: 'A senior accountant', roleB: 'A junior accountant', place: 'At an accounting firm' },
  ],
  opening: {
    1: [(v) => `${v.B.first}, I wanted to give you an update on ${v.inst.mine}.`, (v) => `${v.B.first}, do you have a few minutes to discuss ${v.inst.mine}?`],
    2: [(v) => `${v.B.first}, I just got off the phone with the client about ${v.inst.mine}.`, (v) => `${v.B.first}, ${v.third.title} looked over ${v.inst.mine} this morning.`],
    3: [(v) => `${v.B.first}, so, the client meeting ran long today. They had a lot to say, mostly about ${v.inst.mine}.`, (v) => `${v.B.first}, you know how we were worried about ${v.third.title}'s reaction? About ${v.inst.mine}...`],
  },
  bReply: [() => "Oh? How did it go?", () => "And? What did they think?"],
  aDetail: () => 'Overall they were happy, but they want the first phase finished two weeks earlier than planned.',
  detailQ: () => ({
    stem: 'What does the client want?',
    answer: 'An earlier completion date',
    d: [o('A lower price', 'reasonable_but_unstated'), o('A different design', 'reasonable_but_unstated'), o('A second project', 'reasonable_but_unstated')],
  }),
  purpose: (v) => `To discuss feedback on ${v.inst.gen}`,
  purposeD: () => [o('To schedule a client meeting', 'keyword_overlap'), o('To hire additional staff permanently', 'reasonable_but_unstated'), o('To complain about a coworker', 'reasonable_but_unstated'), o('To announce a promotion', 'reasonable_but_unstated')],
  topic: () => "A client's reaction to a project",
  topicD: () => [o('A long meeting', 'true_but_irrelevant'), o('A new hiring policy', 'reasonable_but_unstated'), o('An office move', 'reasonable_but_unstated')],
  comps: [
    {
      id: 'short_staffed',
      bLine: (v) => `Two weeks earlier? We're already short-staffed with ${v.third.first} on leave.`,
      aReact: () => "I know. I told them it would be difficult.",
      problem: () => 'The team does not have enough people.',
      problemD: () => [o('The client canceled the project.', 'reasonable_but_unstated'), o('The budget was reduced.', 'reasonable_but_unstated'), o('A team member was promoted.', 'reasonable_but_unstated')],
      intents: [
        {
          id: 'budget_contractor',
          speaker: 'A',
          line: () => "They did say budget isn't an issue.",
          why: () => 'To suggest hiring outside help',
          whyD: () => [o('To report the exact budget', 'literal_interpretation'), o('To say the project will be canceled', 'opposite_meaning'), o('To complain about the client', 'reasonable_but_unstated')],
          implies: () => 'The client may pay for extra staff.',
          impliesD: () => [o('The budget has been cut.', 'opposite_meaning'), o('The client has not paid yet.', 'reasonable_but_unstated'), o('The team will work for free.', 'reasonable_but_unstated')],
          reply: () => "Then let's bring in a contractor for a few weeks.",
          indirect: 3,
          next: [
            { id: 'post_listing', speaker: 'B', line: () => "I'll contact the agency we used last spring this afternoon.", answer: () => 'Contact a staffing agency', d: () => [o('Meet with the client', 'reasonable_but_unstated'), o('Extend the deadline', 'opposite_meaning'), o('Prepare a budget report', 'keyword_overlap')] },
          ],
        },
        {
          id: 'scope',
          speaker: 'B',
          line: () => "Did they say which parts matter most to them?",
          why: () => 'To suggest focusing on priority tasks first',
          whyD: () => [o('To check whether the client attended', 'reasonable_but_unstated'), o('To request a list of all tasks', 'literal_interpretation'), o('To refuse the new deadline', 'opposite_meaning')],
          implies: () => 'Some work could be delivered later.',
          impliesD: () => [o('Every part must be finished early.', 'opposite_meaning'), o('The client did not give feedback.', 'reasonable_but_unstated'), o('The project will be canceled.', 'reasonable_but_unstated')],
          reply: () => "Good question — I'll ask them to rank the features.",
          indirect: 2,
          next: [
            { id: 'email_client', speaker: 'A', line: () => "I'll send them an e-mail as soon as we're done here.", answer: () => 'E-mail the client', d: () => [o('Hire more staff', 'reasonable_but_unstated'), o('Visit the client in person', 'reasonable_but_unstated'), o('Update a schedule', 'reasonable_but_unstated')] },
          ],
        },
      ],
    },
  ],
};

// ===========================================================================
// 8. HR matter (time off / training)
// ===========================================================================
const hrMatter: Goal = {
  id: 'hr',
  isCall: false,
  instances: [
    { sit: 'hr', mine: 'my vacation request for next month', gen: 'time off', the: 'the request', roleA: 'An employee', roleB: 'A supervisor', place: 'At a workplace', kind: 'leave' },
    { sit: 'training', mine: 'the project management certification course', gen: 'a training course', the: 'the course', roleA: 'An employee', roleB: 'A manager', place: 'At a company', kind: 'course' },
    { sit: 'conference', mine: 'attending the sales conference in Denver', gen: 'a business trip', the: 'the trip', roleA: 'A sales representative', roleB: 'A sales manager', place: 'At a company', kind: 'course' },
  ],
  opening: {
    1: [(v) => `${v.B.first}, do you have a moment to talk about ${v.inst.mine}?`, (v) => `${v.B.first}, I wanted to ask you about ${v.inst.mine}.`],
    2: [(v) => `${v.B.first}, I noticed ${v.inst.mine} is still marked as pending in the system.`, (v) => `${v.B.first}, I read the e-mail about ${v.inst.mine} this morning, and I'm very interested.`],
    3: [
      (v) => (v.inst.kind === 'leave' ? `${v.B.first}, my sister is getting married in ${v.city} next month. Which, well, is partly why I'm here — it's about ${v.inst.mine}.` : ''),
      (v) => (v.inst.kind === 'course' ? `${v.B.first}, I've been thinking a lot about where I want to be in five years. And that got me looking at ${v.inst.mine}.` : ''),
    ],
  },
  bReply: [() => "Sure, come in. What's on your mind?", () => "Of course. Have a seat."],
  aDetail: (v) =>
    v.inst.kind === 'leave'
      ? `I'd need to be away from ${v.day} the 3rd through the 10th, which is right after the product launch.`
      : `It runs for a full week starting ${v.day} the 3rd, which is right after the product launch.`,
  detailQ: () => ({
    stem: 'When will the speaker need to be away?',
    answer: 'After a product launch',
    d: [o('Before a product launch', 'wrong_time'), o('During a training course', 'reasonable_but_unstated'), o('At the end of the year', 'reasonable_but_unstated')],
  }),
  purpose: (v) => `To ask about ${v.inst.gen}`,
  purposeD: (v) => [o('To announce a wedding', 'true_but_irrelevant'), o(`To request a transfer to ${v.city}`, 'keyword_overlap'), o('To complain about a coworker', 'reasonable_but_unstated'), o('To report a scheduling error', 'reasonable_but_unstated')],
  topic: (v) => `A request regarding ${v.inst.gen}`,
  topicD: (v) => [o(`A wedding in ${v.city}`, 'true_but_irrelevant'), o('A product launch', 'true_but_irrelevant'), o('A salary increase', 'reasonable_but_unstated')],
  comps: [
    {
      id: 'coverage',
      bLine: () => "The only concern is coverage. Half the team is already off that week.",
      aReact: () => "I was afraid you'd say that.",
      problem: () => 'Several people will be absent at the same time.',
      problemD: () => [o('The launch has been postponed.', 'reasonable_but_unstated'), o('The request was submitted late.', 'reasonable_but_unstated'), o('The system lost some data.', 'keyword_overlap')],
      intents: [
        {
          id: 'trained_marco',
          speaker: 'A',
          line: (v) => `I did spend last month training ${v.third.first} on my accounts.`,
          why: () => 'To show that the work will be covered',
          whyD: (v) => [o(`To complain about ${v.third.first}`, 'reasonable_but_unstated'), o('To describe a training program', 'literal_interpretation'), o(`To request that ${v.third.first} be promoted`, 'reasonable_but_unstated')],
          implies: (v) => `${v.third.first} can handle the work during the absence.`,
          impliesD: (v) => [o(`${v.third.first} will also be away.`, 'opposite_meaning'), o(`${v.third.first} needs more training.`, 'opposite_meaning'), o('The accounts will be closed.', 'reasonable_but_unstated')],
          reply: () => "Oh, I didn't realize that. That changes things.",
          indirect: 2,
          next: [
            { id: 'approve', speaker: 'B', line: () => "Let me look at the schedule tonight, and I'll approve it in the system tomorrow.", answer: () => 'Review a schedule', d: () => [o('Train a new employee', 'keyword_overlap'), o('Postpone a product launch', 'reasonable_but_unstated'), o('Hire a temporary worker', 'reasonable_but_unstated')] },
          ],
        },
      ],
    },
    {
      id: 'budget_frozen',
      kinds: ['course'],
      bLine: () => "The trouble is, the training budget is frozen until the new fiscal year.",
      aReact: () => "When does that start?",
      problem: () => 'Funding is currently unavailable.',
      problemD: () => [o('The course is full.', 'reasonable_but_unstated'), o('The instructor has left.', 'reasonable_but_unstated'), o('The request form is incorrect.', 'reasonable_but_unstated')],
      intents: [
        {
          id: 'pay_myself',
          speaker: 'A',
          line: () => "Honestly, I'd be happy to cover half the cost myself.",
          why: () => 'To show strong commitment',
          whyD: () => [o('To complain about the budget', 'reasonable_but_unstated'), o('To ask for a salary advance', 'reasonable_but_unstated'), o('To withdraw the request', 'opposite_meaning')],
          implies: () => 'The speaker really wants to take part.',
          impliesD: () => [o('The speaker has changed his or her mind.', 'opposite_meaning'), o('The course is free.', 'reasonable_but_unstated'), o('The company will pay in full.', 'reasonable_but_unstated')],
          reply: () => "That's generous. Let me see if the department can match that.",
          indirect: 2,
          next: [
            { id: 'ask_director', speaker: 'B', line: (v) => `I'll bring it up with ${v.third.title} at tomorrow's budget meeting.`, answer: () => 'Raise the issue at a meeting', d: () => [o('Sign up for the course', 'wrong_person'), o('Change the fiscal year', 'keyword_overlap'), o('Reject the request', 'opposite_meaning')] },
          ],
        },
      ],
    },
  ],
};

export const GOALS: Goal[] = [changeBooking, orderStatus, equipmentProblem, requestHelp, planEvent, purchaseInquiry, projectUpdate, hrMatter];
