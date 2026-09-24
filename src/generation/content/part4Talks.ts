/**
 * Part 4 talk grammar: talk kit × instance × turn (setup → intent line →
 * follow-up → request). Tiers control how explicitly the purpose is stated.
 */
import type { DistractorType, Situation } from '../../domain/types';
import type { Person } from '../lexicon';

export interface TInst {
  sit: Situation;
  f: Record<string, string>;
  role: string; // "A store manager"
  place: string; // "At a supermarket"
  kind?: string;
}

export interface TV {
  S: Person; // speaker
  L: Person; // listener (voicemail)
  third: Person;
  i: TInst;
  day: string;
  day2: string;
  time: string;
  city: string;
  company: string;
  n: string;
}

export interface TOpt {
  text: string;
  type: DistractorType;
}

export interface TalkTurn {
  id: string;
  kinds?: string[];
  setup: (v: TV) => string;
  line: (v: TV) => string;
  why: (v: TV) => string;
  whyD: (v: TV) => TOpt[];
  implies: (v: TV) => string;
  impliesD: (v: TV) => TOpt[];
  indirect: 1 | 2 | 3;
  follow: (v: TV) => string;
  request: (v: TV) => string;
  reqStem: string;
  reqAnswer: (v: TV) => string;
  reqD: (v: TV) => TOpt[];
  problem: (v: TV) => string;
  problemD: (v: TV) => TOpt[];
}

export interface TalkKit {
  id: string;
  type: 'voicemail' | 'announcement' | 'meeting' | 'tour' | 'workshop' | 'broadcast';
  title: string;
  instances: TInst[];
  opening: Record<1 | 2 | 3, ((v: TV) => string)[]>;
  detail: (v: TV) => string;
  detailQ: (v: TV) => { stem: string; answer: string; d: TOpt[] };
  purposeStem: string;
  purpose: (v: TV) => string;
  purposeD: (v: TV) => TOpt[];
  roleStem: string;
  turns: TalkTurn[];
}

const o = (text: string, type: DistractorType): TOpt => ({ text, type });

// ===========================================================================
const voicemailClient: TalkKit = {
  id: 'vm_client',
  type: 'voicemail',
  title: 'Telephone message',
  instances: [
    { sit: 'shipping', f: { biz: 'Tidewater Shipping', item: 'your shipment of glass display cases', gen: 'a shipment', event: 'grand opening' }, role: 'A shipping company employee', place: 'At a shipping company' },
    { sit: 'events', f: { biz: 'Horizon Event Services', item: 'the stage equipment for your product launch', gen: 'an equipment rental', event: 'product launch' }, role: 'An event services coordinator', place: 'At an event services company' },
    { sit: 'manufacturing', f: { biz: 'Castell Engineering', item: 'the custom brackets you ordered', gen: 'a custom order', event: 'installation' }, role: 'A manufacturer representative', place: 'At a manufacturing company' },
    { sit: 'real_estate', f: { biz: 'Bluestone Properties', item: 'the renovation of your storefront', gen: 'a renovation', event: 'grand opening' }, role: 'A property manager', place: 'At a property management company' },
  ],
  opening: {
    1: [(v) => `Hi, ${v.L.title}, this is ${v.S.full} from ${v.i.f.biz}. I'm calling about a problem with ${v.i.f.item}.`, (v) => `Hello, ${v.L.title}. It's ${v.S.full} at ${v.i.f.biz}, calling with an update on ${v.i.f.item}.`],
    2: [(v) => `Hi, ${v.L.title}, ${v.S.full} from ${v.i.f.biz} here. I've just had a look at the schedule for ${v.i.f.item}, and it isn't what we promised you.`],
    3: [(v) => `Good morning, ${v.L.title}. ${v.S.full} from ${v.i.f.biz}. First of all, thank you again for choosing us — we really enjoyed working with your team last year. I'm calling because of ${v.i.f.item}.`],
  },
  detail: (v) => `As you know, everything was scheduled to be completed on ${v.day}.`,
  detailQ: (v) => ({ stem: 'When was the work originally scheduled to be completed?', answer: `On ${v.day}`, d: [o(`On ${v.day2}`, 'wrong_time'), o('Last year', 'true_but_irrelevant'), o('This morning', 'reasonable_but_unstated')] }),
  purposeStem: 'Why is the speaker calling?',
  purpose: (v) => `To report a problem with ${v.i.f.gen}`,
  purposeD: (v) => [o('To thank a customer for a referral', 'true_but_irrelevant'), o(`To request payment for ${v.i.f.gen}`, 'keyword_overlap'), o('To advertise a new service', 'reasonable_but_unstated'), o('To confirm a completed delivery', 'opposite_meaning')],
  roleStem: 'Who most likely is the speaker?',
  turns: [
    {
      id: 'supplier_short',
      setup: () => "Unfortunately, one of our suppliers has run short of materials, so we're about a week behind.",
      line: (v) => `Now, I realize your ${v.i.f.event} is on the fifteenth.`,
      why: () => 'To show that he or she understands the deadline is important',
      whyD: () => [o('To confirm the date of an event', 'literal_interpretation'), o('To invite the listener to an event', 'keyword_overlap'), o('To suggest postponing the event', 'reasonable_but_unstated')],
      implies: () => 'The delay could cause a serious problem for the listener.',
      impliesD: () => [o('The event has been canceled.', 'reasonable_but_unstated'), o('The speaker plans to attend the event.', 'keyword_overlap'), o('The delay is not important.', 'opposite_meaning')],
      indirect: 2,
      follow: () => "So we'd like to offer you two options.",
      request: () => 'Please call me back by the end of the day so we can decide together.',
      reqStem: 'What does the speaker ask the listener to do?',
      reqAnswer: () => 'Return a call',
      reqD: () => [o('Visit a supplier', 'true_but_irrelevant'), o('Sign a contract', 'reasonable_but_unstated'), o('Postpone an event', 'reasonable_but_unstated')],
      problem: () => 'A supplier could not provide enough materials.',
      problemD: () => [o('A delivery address was incorrect.', 'reasonable_but_unstated'), o('The price of materials increased.', 'reasonable_but_unstated'), o('A payment was not received.', 'reasonable_but_unstated')],
    },
    {
      id: 'wrong_spec',
      setup: () => "When we checked the order, we noticed the measurements on the form don't match the drawings you sent.",
      line: () => "Our team has done a lot of these, and ninety centimeters is fairly unusual.",
      why: () => 'To suggest that there may be an error in the order',
      whyD: () => [o('To praise the experience of the team', 'literal_interpretation'), o('To recommend a larger size', 'reasonable_but_unstated'), o('To explain a price increase', 'reasonable_but_unstated')],
      implies: () => 'The measurement on the form might be a mistake.',
      impliesD: () => [o('The team has never done this kind of work.', 'opposite_meaning'), o('Unusual sizes are not allowed.', 'reasonable_but_unstated'), o('The drawings were lost.', 'reasonable_but_unstated')],
      indirect: 3,
      follow: () => "I'd rather check with you than guess.",
      request: () => 'Could you e-mail me the correct measurements when you get a chance?',
      reqStem: 'What does the speaker ask the listener to do?',
      reqAnswer: () => 'Confirm some information',
      reqD: () => [o('Pay a deposit', 'reasonable_but_unstated'), o('Visit the office', 'reasonable_but_unstated'), o('Choose a new color', 'reasonable_but_unstated')],
      problem: () => 'Some details in an order do not match.',
      problemD: () => [o('A product is out of stock.', 'reasonable_but_unstated'), o('A team member is unavailable.', 'reasonable_but_unstated'), o('An invoice was sent twice.', 'reasonable_but_unstated')],
    },
    {
      id: 'price_change',
      setup: () => "The cost of steel has gone up quite a bit since we sent you our estimate.",
      line: () => "We honored the old price for another client last month.",
      why: () => 'To indicate that the original price might still be possible',
      whyD: () => [o('To mention a recent project', 'literal_interpretation'), o('To explain why the estimate is late', 'reasonable_but_unstated'), o('To say that prices will increase further', 'opposite_meaning')],
      implies: () => 'An exception may be made for the listener.',
      impliesD: () => [o('The other client complained.', 'reasonable_but_unstated'), o('The listener must pay more.', 'opposite_meaning'), o('The speaker no longer works with that client.', 'reasonable_but_unstated')],
      indirect: 3,
      follow: () => "I just need my manager to sign off on it.",
      request: () => "I'll call again tomorrow morning once I've spoken to her.",
      reqStem: 'What will the speaker do tomorrow?',
      reqAnswer: () => 'Make another phone call',
      reqD: () => [o('Send a revised estimate', 'reasonable_but_unstated'), o('Meet with a client', 'keyword_overlap'), o('Order more steel', 'keyword_overlap')],
      problem: () => 'A material has become more expensive.',
      problemD: () => [o('A delivery was damaged.', 'reasonable_but_unstated'), o('A manager is on vacation.', 'reasonable_but_unstated'), o('An estimate was lost.', 'keyword_overlap')],
    },
  ],
};

// ===========================================================================
const storeAnnouncement: TalkKit = {
  id: 'store_ann',
  type: 'announcement',
  title: 'Announcement',
  instances: [
    { sit: 'retail', f: { biz: 'Everly Furniture', aud: 'shoppers', area: 'the checkout area' }, role: 'A store employee', place: 'At a furniture store' },
    { sit: 'retail', f: { biz: 'Summit Outdoor Gear', aud: 'shoppers', area: 'the front registers' }, role: 'A store manager', place: 'At a sporting goods store' },
    { sit: 'retail', f: { biz: 'Fresh Harvest Market', aud: 'shoppers', area: 'the customer service desk' }, role: 'A supermarket employee', place: 'At a supermarket' },
    { sit: 'events', f: { biz: 'the Lakeview Home Show', aud: 'visitors', area: 'the main entrance' }, role: 'An event organizer', place: 'At a trade show' },
  ],
  opening: {
    1: [(v) => `Attention, ${v.i.f.aud}. We'd like to let you know that ${v.i.f.biz} will be closing early today at six o'clock.`, (v) => `Good afternoon, ${v.i.f.aud}, and welcome to ${v.i.f.biz}. This is a reminder that we're closing at six today.`],
    2: [(v) => `Good afternoon, ${v.i.f.aud}. Just a quick note: the lights in the parking lot are being replaced this evening, and for safety reasons, ${v.i.f.biz} will need to close at six.`],
    3: [(v) => `Hello, ${v.i.f.aud}. Thank you for spending your afternoon at ${v.i.f.biz}. Our crews are replacing the lights in the parking lot tonight, and, well, they need the lot empty by six-thirty.`],
  },
  detail: () => 'Our regular hours will return tomorrow morning at nine.',
  detailQ: () => ({ stem: 'When will regular hours resume?', answer: 'Tomorrow morning', d: [o('This evening', 'wrong_time'), o('Next week', 'reasonable_but_unstated'), o('At six-thirty', 'wrong_time')] }),
  purposeStem: 'What is the purpose of the announcement?',
  purpose: () => 'To inform people of a schedule change',
  purposeD: () => [o('To advertise lighting products', 'keyword_overlap'), o('To announce a parking fee', 'reasonable_but_unstated'), o('To introduce new staff', 'reasonable_but_unstated'), o('To thank customers for their loyalty', 'true_but_irrelevant')],
  roleStem: 'Where is the announcement most likely being made?',
  turns: [
    {
      id: 'lines_long',
      setup: (v) => `We know many of you still have items to purchase.`,
      line: () => 'The lines at the registers usually get very long around five.',
      why: () => 'To encourage listeners to pay soon',
      whyD: () => [o('To apologize for slow service', 'reasonable_but_unstated'), o('To describe the store\'s busiest time', 'literal_interpretation'), o('To announce that more registers will open', 'reasonable_but_unstated')],
      implies: () => 'Shoppers should pay for their items soon.',
      impliesD: () => [o('The store will stay open late.', 'opposite_meaning'), o('The registers are broken.', 'reasonable_but_unstated'), o('Staff members are leaving at five.', 'keyword_overlap')],
      indirect: 2,
      follow: (v) => `Self-checkout machines are also available near ${v.i.f.area}.`,
      request: () => 'Thank you, and please drive carefully when you leave.',
      reqStem: 'What are listeners asked to do?',
      reqAnswer: () => 'Drive carefully',
      reqD: () => [o('Use a different entrance', 'reasonable_but_unstated'), o('Come back tomorrow', 'true_but_irrelevant'), o('Park on the street', 'keyword_overlap')],
      problem: () => 'Outdoor lighting is being replaced.',
      problemD: () => [o('A staff meeting is being held.', 'reasonable_but_unstated'), o('The registers are not working.', 'keyword_overlap'), o('A delivery is arriving.', 'reasonable_but_unstated')],
    },
    {
      id: 'online_order',
      setup: () => "If you don't have time to finish shopping, don't worry.",
      line: () => "Our website has the same prices as the store, you know.",
      why: () => 'To suggest an alternative way to shop',
      whyD: () => [o('To announce a price increase', 'opposite_meaning'), o('To explain how prices are set', 'literal_interpretation'), o('To promote a new website design', 'keyword_overlap')],
      implies: () => 'Customers can buy the items online later without paying more.',
      impliesD: () => [o('The website is not working.', 'reasonable_but_unstated'), o('Online prices are higher.', 'opposite_meaning'), o('The store will close permanently.', 'reasonable_but_unstated')],
      indirect: 2,
      follow: () => 'And orders placed tonight will be ready for pickup tomorrow.',
      request: () => 'Please make your way to the registers in the next half hour.',
      reqStem: 'What are listeners asked to do?',
      reqAnswer: () => 'Proceed to the checkout',
      reqD: () => [o('Visit the website now', 'keyword_overlap'), o('Fill out a survey', 'reasonable_but_unstated'), o('Pick up an order tomorrow', 'true_but_irrelevant')],
      problem: () => 'The business must close earlier than usual.',
      problemD: () => [o('Prices have changed.', 'keyword_overlap'), o('The website is down.', 'reasonable_but_unstated'), o('Some items are sold out.', 'reasonable_but_unstated')],
    },
  ],
};

// ===========================================================================
const travelAnnouncement: TalkKit = {
  id: 'travel_ann',
  type: 'announcement',
  title: 'Announcement',
  instances: [
    { sit: 'airport', f: { vehicle: 'Flight 208', dest: 'Vancouver', where: 'gate', aud: 'passengers' }, role: 'An airline employee', place: 'At an airport' },
    { sit: 'travel', f: { vehicle: 'the 4:15 express train', dest: 'Rotterdam', where: 'platform', aud: 'passengers' }, role: 'A railway employee', place: 'At a train station' },
    { sit: 'travel', f: { vehicle: 'the afternoon ferry', dest: 'Harbor Island', where: 'pier', aud: 'passengers' }, role: 'A ferry company employee', place: 'At a ferry terminal' },
  ],
  opening: {
    1: [(v) => `Attention, ${v.i.f.aud} traveling on ${v.i.f.vehicle} to ${v.i.f.dest}. This service has been delayed by about forty minutes.`],
    2: [(v) => `Good afternoon, ${v.i.f.aud} traveling on ${v.i.f.vehicle} to ${v.i.f.dest}. We've just been informed that the crew scheduled for this service is still on its way from ${v.city}.`],
    3: [(v) => `Good afternoon. For those of you waiting for ${v.i.f.vehicle} to ${v.i.f.dest}, thank you for your patience. The weather in ${v.city} this morning caused some problems across our network, and it's now affecting this service as well.`],
  },
  detail: (v) => `The new departure time is ${v.time}, and boarding will begin fifteen minutes before that.`,
  detailQ: (v) => ({ stem: 'When will boarding begin?', answer: `Fifteen minutes before ${v.time}`, d: [o(`At ${v.time}`, 'wrong_time'), o('In forty minutes', 'reasonable_but_unstated'), o('After a crew change', 'reasonable_but_unstated')] }),
  purposeStem: 'What is the announcement mainly about?',
  purpose: () => 'A delayed departure',
  purposeD: (v) => [o(`Weather conditions in ${v.city}`, 'true_but_irrelevant'), o('A canceled service', 'reasonable_but_unstated'), o('A new route', 'reasonable_but_unstated'), o('Lost luggage', 'reasonable_but_unstated')],
  roleStem: 'Where is the announcement most likely being made?',
  turns: [
    {
      id: 'vouchers',
      setup: () => 'We apologize for the inconvenience.',
      line: () => 'The café next to the waiting area accepts our meal vouchers.',
      why: () => 'To let listeners know they can get food',
      whyD: () => [o('To advertise a new café', 'literal_interpretation'), o('To explain a payment policy', 'reasonable_but_unstated'), o('To ask listeners to leave the waiting area', 'reasonable_but_unstated')],
      implies: () => 'Passengers may use vouchers for a meal while they wait.',
      impliesD: () => [o('The café is closed.', 'opposite_meaning'), o('Vouchers must be purchased.', 'reasonable_but_unstated'), o('Passengers must stay in their seats.', 'reasonable_but_unstated')],
      indirect: 2,
      follow: (v) => `You can pick one up at the ${v.i.f.where} desk.`,
      request: (v) => `Please remain near the ${v.i.f.where} so that you can hear further announcements.`,
      reqStem: 'What are listeners asked to do?',
      reqAnswer: () => 'Stay close to the departure area',
      reqD: () => [o('Buy a new ticket', 'reasonable_but_unstated'), o('Check their luggage', 'reasonable_but_unstated'), o('Go to the café immediately', 'keyword_overlap')],
      problem: () => 'Staff members have not arrived yet.',
      problemD: () => [o('A vehicle needs repairs.', 'reasonable_but_unstated'), o('The destination is closed.', 'reasonable_but_unstated'), o('Tickets were sold twice.', 'reasonable_but_unstated')],
    },
    {
      id: 'connections',
      setup: () => 'We understand that some of you have connections to make.',
      line: () => "Our staff at the service desk have the latest schedules for all other routes.",
      why: () => 'To suggest where listeners can get help rearranging travel',
      whyD: () => [o('To introduce new staff members', 'reasonable_but_unstated'), o('To say that all routes are delayed', 'reasonable_but_unstated'), o('To describe the job of service desk staff', 'literal_interpretation')],
      implies: () => 'Passengers with connections should speak to the service desk.',
      impliesD: () => [o('No other routes are available.', 'opposite_meaning'), o('The schedules have not been updated.', 'opposite_meaning'), o('The service desk is closed.', 'reasonable_but_unstated')],
      indirect: 2,
      follow: () => "They'll be happy to help you find another option.",
      request: () => 'Once again, thank you for your patience.',
      reqStem: 'What does the speaker thank listeners for?',
      reqAnswer: () => 'Their patience',
      reqD: () => [o('Their feedback', 'reasonable_but_unstated'), o('Choosing an early service', 'reasonable_but_unstated'), o('Making connections on time', 'keyword_overlap')],
      problem: () => 'Earlier weather caused schedule disruptions.',
      problemD: () => [o('A route was canceled permanently.', 'reasonable_but_unstated'), o('Tickets have become more expensive.', 'reasonable_but_unstated'), o('The station is being renovated.', 'reasonable_but_unstated')],
    },
  ],
};

// ===========================================================================
const meetingUpdate: TalkKit = {
  id: 'meeting',
  type: 'meeting',
  title: 'Excerpt from a meeting',
  instances: [
    { sit: 'technology', f: { change: 'the new project-tracking software', gen: 'a software system', team: 'development team' }, role: 'A team manager', place: 'At a software company' },
    { sit: 'office', f: { change: 'the move to the new office on Station Road', gen: 'an office relocation', team: 'staff' }, role: 'An office manager', place: 'At a company' },
    { sit: 'hr', f: { change: 'the new flexible working policy', gen: 'a policy change', team: 'staff' }, role: 'A human resources manager', place: 'At a company' },
    { sit: 'manufacturing', f: { change: 'the new safety inspection procedure', gen: 'a new procedure', team: 'floor supervisors' }, role: 'A plant manager', place: 'At a factory' },
    { sit: 'customer_service', f: { change: 'the new customer feedback system', gen: 'a new system', team: 'support team' }, role: 'A customer service manager', place: 'At a call center' },
  ],
  opening: {
    1: [(v) => `Good morning, everyone. Today I want to go over ${v.i.f.change}, which starts next ${v.day}.`],
    2: [(v) => `Morning, everyone. So, a lot of you have been asking me when ${v.i.f.change} is actually happening. Well, it's next ${v.day}.`],
    3: [(v) => `Morning, everyone. Before we get to the sales figures, there's something that affects every single one of you — and I know there have been a lot of rumors. It's about ${v.i.f.change}.`],
  },
  detail: (v) => `${v.third.title} from the regional office will be here on ${v.day2} to answer questions.`,
  detailQ: (v) => ({ stem: `Who will visit on ${v.day2}?`, answer: 'A representative from another office', d: [o('A new client', 'reasonable_but_unstated'), o('A software vendor', 'reasonable_but_unstated'), o('A job candidate', 'reasonable_but_unstated')] }),
  purposeStem: 'What is the speaker mainly discussing?',
  purpose: (v) => `The introduction of ${v.i.f.gen}`,
  purposeD: () => [o('Quarterly sales figures', 'true_but_irrelevant'), o('Rumors about layoffs', 'keyword_overlap'), o('A customer complaint', 'reasonable_but_unstated'), o('A hiring freeze', 'reasonable_but_unstated')],
  roleStem: 'Who most likely is the speaker?',
  turns: [
    {
      id: 'learning_curve',
      setup: () => "I know change can be stressful, especially in our busiest season.",
      line: () => "When we switched systems three years ago, it took most people about a week.",
      why: () => 'To reassure listeners that they will adjust quickly',
      whyD: () => [o('To describe the history of the company', 'literal_interpretation'), o('To warn that the change will take months', 'opposite_meaning'), o('To explain why the old system failed', 'reasonable_but_unstated')],
      implies: () => 'The adjustment period should be short.',
      impliesD: () => [o('The last change was unsuccessful.', 'reasonable_but_unstated'), o('The system will be replaced again.', 'reasonable_but_unstated'), o('Employees will need a month of training.', 'opposite_meaning')],
      indirect: 2,
      follow: () => "And this time, we've scheduled training sessions for every team.",
      request: () => "Please sign up for a session on the sheet by the door before you leave today.",
      reqStem: 'What are listeners asked to do?',
      reqAnswer: () => 'Register for a training session',
      reqD: () => [o('Read a manual', 'reasonable_but_unstated'), o('Contact the regional office', 'true_but_irrelevant'), o('Submit sales figures', 'true_but_irrelevant')],
      problem: () => 'The timing coincides with a busy period.',
      problemD: () => [o('The budget has been cut.', 'reasonable_but_unstated'), o('The trainer is unavailable.', 'reasonable_but_unstated'), o('The system has been delayed.', 'reasonable_but_unstated')],
    },
    {
      id: 'questions_board',
      setup: () => "I'm sure you have a lot of questions, and I don't have all the answers yet.",
      line: (v) => `${v.third.first} has been working on this for six months.`,
      why: (v) => `To indicate that ${v.third.first} can answer questions`,
      whyD: (v) => [o(`To praise ${v.third.first}'s hard work`, 'literal_interpretation'), o('To explain why the project is late', 'reasonable_but_unstated'), o(`To announce ${v.third.first}'s promotion`, 'reasonable_but_unstated')],
      implies: (v) => `${v.third.first} is the best person to ask about the details.`,
      impliesD: (v) => [o(`${v.third.first} is leaving the company.`, 'reasonable_but_unstated'), o('The project has been canceled.', 'opposite_meaning'), o(`${v.third.first} needs help with the project.`, 'reasonable_but_unstated')],
      indirect: 3,
      follow: (v) => `So make the most of ${v.third.first}'s visit on ${v.day2}.`,
      request: () => "In the meantime, please write your questions on the board in the break room.",
      reqStem: 'What does the speaker ask listeners to do?',
      reqAnswer: () => 'Write down their questions',
      reqD: (v) => [o('Attend a meeting on ' + v.day, 'wrong_time'), o('Take a break', 'keyword_overlap'), o('Volunteer for a project', 'reasonable_but_unstated')],
      problem: () => 'Some information is not yet available.',
      problemD: () => [o('A deadline has been missed.', 'reasonable_but_unstated'), o('An employee has resigned.', 'reasonable_but_unstated'), o('The break room is closed.', 'keyword_overlap')],
    },
  ],
};

// ===========================================================================
const tourIntro: TalkKit = {
  id: 'tour',
  type: 'tour',
  title: 'Talk',
  instances: [
    { sit: 'manufacturing', f: { site: 'our chocolate factory', gen: 'a factory', stop: 'the packaging room' }, role: 'A tour guide', place: 'At a factory', kind: 'factory' },
    { sit: 'travel', f: { site: 'the Harbor Maritime Museum', gen: 'a museum', stop: 'the ship model gallery' }, role: 'A museum guide', place: 'At a museum' },
    { sit: 'manufacturing', f: { site: 'the Solano Textiles plant', gen: 'a textile plant', stop: 'the dyeing area' }, role: 'A plant supervisor', place: 'At a manufacturing plant', kind: 'factory' },
    { sit: 'travel', f: { site: 'the Greenfield Botanical Garden', gen: 'a garden', stop: 'the tropical greenhouse' }, role: 'A tour guide', place: 'At a botanical garden' },
  ],
  opening: {
    1: [(v) => `Welcome to ${v.i.f.site}. My name is ${v.S.first}, and I'll be leading your tour this morning.`],
    2: [(v) => `Good morning, everyone, and welcome to ${v.i.f.site}. I'm ${v.S.first}, and for the next hour, you'll see how everything here works.`],
    3: [(v) => `Good morning! Is everyone able to hear me in the back? Great. So, over the next hour, I'm going to show you parts of ${v.i.f.site} that most visitors never see.`],
  },
  detail: (v) => `We'll finish in ${v.i.f.stop}, where you can take photographs.`,
  detailQ: (v) => ({ stem: 'Where will the tour end?', answer: `In ${v.i.f.stop}`, d: [o('At the main entrance', 'reasonable_but_unstated'), o('In the gift shop', 'reasonable_but_unstated'), o('In a café', 'reasonable_but_unstated')] }),
  purposeStem: 'What is the purpose of the talk?',
  purpose: () => 'To introduce a guided tour',
  purposeD: () => [o('To advertise a photography class', 'keyword_overlap'), o('To recruit new employees', 'reasonable_but_unstated'), o('To announce a closure', 'reasonable_but_unstated'), o('To describe safety equipment', 'reasonable_but_unstated')],
  roleStem: 'Who most likely is the speaker?',
  turns: [
    {
      id: 'shoes',
      setup: () => "Before we begin, a quick safety note.",
      line: () => "Some of the floors in the next area can be a little slippery.",
      why: () => 'To warn listeners to be careful',
      whyD: () => [o('To apologize for the condition of the building', 'reasonable_but_unstated'), o('To describe how the floors are cleaned', 'literal_interpretation'), o('To explain why the tour is short', 'reasonable_but_unstated')],
      implies: () => 'Visitors should watch their step.',
      impliesD: () => [o('The area is closed to visitors.', 'reasonable_but_unstated'), o('The floors are being replaced.', 'reasonable_but_unstated'), o('Visitors should remove their shoes.', 'keyword_overlap')],
      indirect: 1,
      follow: () => 'So please hold on to the handrails where you see them.',
      request: () => "And if you have any questions along the way, just raise your hand.",
      reqStem: 'What does the speaker invite listeners to do?',
      reqAnswer: () => 'Ask questions',
      reqD: () => [o('Take photographs anywhere', 'keyword_overlap'), o('Buy souvenirs', 'reasonable_but_unstated'), o('Leave their bags at the entrance', 'reasonable_but_unstated')],
      problem: () => 'One area has surfaces that may be slippery.',
      problemD: () => [o('The tour is overbooked.', 'reasonable_but_unstated'), o('A machine is broken.', 'reasonable_but_unstated'), o('Photographs are not allowed.', 'opposite_meaning')],
    },
    {
      id: 'samples',
      kinds: ['factory'],
      setup: () => "You'll notice that we're running a little behind schedule today.",
      line: () => "The best part is at the end, trust me.",
      why: () => 'To encourage listeners to stay until the end',
      whyD: () => [o('To apologize for a boring tour', 'reasonable_but_unstated'), o('To explain the order of the tour', 'literal_interpretation'), o('To suggest skipping the first part', 'reasonable_but_unstated')],
      implies: () => 'Something enjoyable is planned for the end of the tour.',
      impliesD: () => [o('The tour will be shortened.', 'reasonable_but_unstated'), o('The end of the tour is optional.', 'reasonable_but_unstated'), o('The schedule has been canceled.', 'opposite_meaning')],
      indirect: 2,
      follow: () => "Everyone gets a free sample on the way out.",
      request: () => "Now, please follow me through the double doors on your left.",
      reqStem: 'What will the listeners most likely do next?',
      reqAnswer: () => 'Walk to another area',
      reqD: () => [o('Receive a free sample', 'true_but_irrelevant'), o('Watch a video', 'reasonable_but_unstated'), o('Take a short break', 'reasonable_but_unstated')],
      problem: () => 'The tour is behind schedule.',
      problemD: () => [o('The guide is new.', 'reasonable_but_unstated'), o('The doors are locked.', 'keyword_overlap'), o('The samples have run out.', 'keyword_overlap')],
    },
  ],
};

// ===========================================================================
const workshopIntro: TalkKit = {
  id: 'workshop',
  type: 'workshop',
  title: 'Talk',
  instances: [
    { sit: 'training', f: { topic: 'writing effective business e-mails', gen: 'business writing', event: 'workshop' }, role: 'A workshop leader', place: 'At a training workshop' },
    { sit: 'conference', f: { topic: 'using data to make marketing decisions', gen: 'marketing analytics', event: 'conference session' }, role: 'A conference speaker', place: 'At a conference' },
    { sit: 'training', f: { topic: 'managing remote teams', gen: 'team management', event: 'seminar' }, role: 'A seminar presenter', place: 'At a seminar' },
    { sit: 'banking', f: { topic: 'planning for small business growth', gen: 'business finance', event: 'workshop' }, role: 'A financial advisor', place: 'At a business workshop' },
  ],
  opening: {
    1: [(v) => `Welcome, everyone, to today's ${v.i.f.event} on ${v.i.f.topic}.`],
    2: [(v) => `Good afternoon, and thanks for coming. Raise your hand if you've ever struggled with ${v.i.f.topic}. ... Yes, that's what I thought.`],
    3: [(v) => `Good afternoon. Let me start with a quick story. Last year, one of my clients lost a major contract, and it all came down to ${v.i.f.topic}.`],
  },
  detail: () => "We'll take a fifteen-minute break at three o'clock.",
  detailQ: () => ({ stem: 'What will happen at three o\'clock?', answer: 'A break will begin.', d: [o('A guest will speak.', 'reasonable_but_unstated'), o('The session will end.', 'reasonable_but_unstated'), o('Lunch will be served.', 'reasonable_but_unstated')] }),
  purposeStem: 'What is the talk mainly about?',
  purpose: (v) => v.i.f.gen.charAt(0).toUpperCase() + v.i.f.gen.slice(1),
  purposeD: () => [o('Winning a contract', 'true_but_irrelevant'), o('Hiring a consultant', 'reasonable_but_unstated'), o('Planning a vacation', 'reasonable_but_unstated'), o('Customer complaints', 'reasonable_but_unstated')],
  roleStem: 'Who most likely is the speaker?',
  turns: [
    {
      id: 'handouts',
      setup: () => "There are handouts on the table at the back.",
      line: () => "We printed forty, and I count about sixty of you.",
      why: () => 'To indicate that there are not enough handouts',
      whyD: () => [o('To report the number of attendees', 'literal_interpretation'), o('To complain about the room size', 'reasonable_but_unstated'), o('To thank people for registering early', 'reasonable_but_unstated')],
      implies: () => 'Some listeners may need to share materials.',
      impliesD: () => [o('More people are expected to arrive.', 'reasonable_but_unstated'), o('Everyone will get a copy.', 'opposite_meaning'), o('The handouts contain errors.', 'reasonable_but_unstated')],
      indirect: 2,
      follow: () => "So please share with the person next to you, and I'll e-mail the file to everyone afterward.",
      request: () => "Now, let's start by introducing ourselves to the people at our tables.",
      reqStem: 'What will the listeners most likely do next?',
      reqAnswer: () => 'Introduce themselves',
      reqD: () => [o('Pick up handouts', 'keyword_overlap'), o('Take a break', 'true_but_irrelevant'), o('Fill out a survey', 'reasonable_but_unstated')],
      problem: () => 'There are fewer copies than people.',
      problemD: () => [o('The room is too small.', 'reasonable_but_unstated'), o('The projector is broken.', 'reasonable_but_unstated'), o('The speaker arrived late.', 'reasonable_but_unstated')],
    },
    {
      id: 'phones',
      setup: () => "This is going to be a very hands-on session.",
      line: () => "You won't need your laptops for the first hour.",
      why: () => 'To tell listeners to put their laptops away',
      whyD: () => [o('To say that laptops will be provided', 'reasonable_but_unstated'), o('To describe the session schedule', 'literal_interpretation'), o('To warn about a network problem', 'reasonable_but_unstated')],
      implies: () => 'The first part of the session will not involve computers.',
      impliesD: () => [o('Laptops are not allowed in the building.', 'reasonable_but_unstated'), o('The session will last only one hour.', 'keyword_overlap'), o('Everyone should turn on their laptops now.', 'opposite_meaning')],
      indirect: 2,
      follow: () => "We'll start with some group exercises instead.",
      request: () => "Please form groups of four with the people around you.",
      reqStem: 'What are listeners asked to do?',
      reqAnswer: () => 'Form small groups',
      reqD: () => [o('Charge their laptops', 'keyword_overlap'), o('Read a handout', 'reasonable_but_unstated'), o('Watch a video', 'reasonable_but_unstated')],
      problem: () => 'Laptops will not be needed at first.',
      problemD: () => [o('The Internet is not working.', 'reasonable_but_unstated'), o('The session was shortened.', 'reasonable_but_unstated'), o('Some participants did not bring laptops.', 'reasonable_but_unstated')],
    },
  ],
};

// ===========================================================================
const broadcast: TalkKit = {
  id: 'broadcast',
  type: 'broadcast',
  title: 'Broadcast',
  instances: [
    { sit: 'marketing', f: { news: 'Kestrel Airlines will begin daily flights to Auckland', gen: 'a new airline route', sector: 'travel' }, role: 'A radio host', place: 'On a radio program' },
    { sit: 'technology', f: { news: 'Lumen Software is opening a research center downtown', gen: 'a new research center', sector: 'technology' }, role: 'A news reporter', place: 'On a news program' },
    { sit: 'real_estate', f: { news: 'the old Mill Lane factory will be turned into apartments', gen: 'a building conversion', sector: 'housing' }, role: 'A radio reporter', place: 'On a local news program' },
    { sit: 'retail', f: { news: 'Veridian Foods is opening its first grocery store in the city', gen: 'a new store', sector: 'retail' }, role: 'A business reporter', place: 'On a business news program' },
  ],
  opening: {
    1: [(v) => `And now for local business news. ${v.i.f.news.charAt(0).toUpperCase() + v.i.f.news.slice(1)}.`],
    2: [(v) => `Good evening, and welcome to Business Hour. Some big news today for the local ${v.i.f.sector} sector: ${v.i.f.news}.`],
    3: [(v) => `Welcome back to Business Hour. If you've driven past the east side of town recently, you may have wondered what all the construction is about. Well, today we found out: ${v.i.f.news}.`],
  },
  detail: (v) => `The project is expected to create about ${v.n} hundred jobs over the next two years.`,
  detailQ: (v) => ({ stem: 'According to the speaker, what will the project do?', answer: 'Create jobs', d: [o('Reduce traffic', 'reasonable_but_unstated'), o('Lower prices', 'reasonable_but_unstated'), o('Close a factory', 'keyword_overlap')] }),
  purposeStem: 'What is the broadcast mainly about?',
  purpose: (v) => v.i.f.gen.charAt(0).toUpperCase() + v.i.f.gen.slice(1),
  purposeD: () => [o('Road construction', 'true_but_irrelevant'), o('A company merger', 'reasonable_but_unstated'), o('A local election', 'reasonable_but_unstated'), o('Job training programs', 'keyword_overlap')],
  roleStem: 'Who most likely is the speaker?',
  turns: [
    {
      id: 'mayor',
      setup: () => "Not everyone was in favor of the plan at first.",
      line: () => "But the city council approved it in less than a week.",
      why: () => 'To emphasize that the plan received strong support',
      whyD: () => [o('To criticize the city council', 'reasonable_but_unstated'), o('To report the date of a vote', 'literal_interpretation'), o('To say the plan was rejected', 'opposite_meaning')],
      implies: () => 'Concerns about the plan were resolved quickly.',
      impliesD: () => [o('The council has not voted yet.', 'opposite_meaning'), o('The plan will take a week to complete.', 'keyword_overlap'), o('Residents are still protesting.', 'reasonable_but_unstated')],
      indirect: 2,
      follow: () => 'Construction is set to begin in the spring.',
      request: () => "Stay with us — after the break, we'll talk to one of the project's architects.",
      reqStem: 'What will listeners hear after the break?',
      reqAnswer: () => 'An interview',
      reqD: () => [o('A weather report', 'reasonable_but_unstated'), o('A traffic update', 'true_but_irrelevant'), o('Music', 'reasonable_but_unstated')],
      problem: () => 'Some people initially opposed the plan.',
      problemD: () => [o('The project is over budget.', 'reasonable_but_unstated'), o('The architect resigned.', 'keyword_overlap'), o('Construction has been delayed.', 'reasonable_but_unstated')],
    },
    {
      id: 'parking',
      setup: () => "Residents nearby have raised concerns about traffic.",
      line: () => "The developer has also bought the empty lot across the street.",
      why: () => 'To suggest that a solution for parking is planned',
      whyD: () => [o('To report a real estate sale', 'literal_interpretation'), o('To criticize the developer', 'reasonable_but_unstated'), o('To announce a second project', 'reasonable_but_unstated')],
      implies: () => 'The extra land may be used to reduce traffic problems.',
      impliesD: () => [o('Traffic will get worse.', 'opposite_meaning'), o('The lot is for sale.', 'keyword_overlap'), o('The residents bought the land.', 'wrong_person')],
      indirect: 3,
      follow: () => "A spokesperson says details will be shared at a public meeting next month.",
      request: () => "You'll find the meeting schedule on our website.",
      reqStem: 'According to the speaker, what can listeners find on a website?',
      reqAnswer: () => 'A meeting schedule',
      reqD: () => [o('A map of the area', 'reasonable_but_unstated'), o('Job openings', 'true_but_irrelevant'), o('Photos of the building', 'reasonable_but_unstated')],
      problem: () => 'People living in the area are worried about traffic.',
      problemD: () => [o('The land is too expensive.', 'reasonable_but_unstated'), o('The meeting was canceled.', 'reasonable_but_unstated'), o('The developer has left the project.', 'reasonable_but_unstated')],
    },
  ],
};

export const TALKS: TalkKit[] = [voicemailClient, storeAnnouncement, travelAnnouncement, meetingUpdate, tourIntro, workshopIntro, broadcast];
