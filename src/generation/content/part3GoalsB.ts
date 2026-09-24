/**
 * Part 3 conversation grammar — second set of goals (novelty capacity).
 */
import type { DistractorType } from '../../domain/types';
import { CV, Goal, He, he, him, his, man, Opt } from './part3Goals';

const o = (text: string, type: DistractorType): Opt => ({ text, type });

// ===========================================================================
// 9. Billing / charge question
// ===========================================================================
const billing: Goal = {
  id: 'billing',
  isCall: true,
  instances: [
    { sit: 'banking', mine: 'a charge on my business credit card', gen: 'a card charge', the: 'the charge', roleA: 'A bank customer', roleB: 'A bank representative', place: 'At a bank' },
    { sit: 'technology', mine: 'our invoice for the cloud storage service', gen: 'an invoice', the: 'the invoice', roleA: 'An office manager', roleB: 'A billing specialist', place: 'At a software company' },
    { sit: 'hotel', mine: 'the bill from my stay last week', gen: 'a hotel bill', the: 'the bill', roleA: 'A former hotel guest', roleB: 'A hotel billing clerk', place: 'At a hotel' },
    { sit: 'customer_service', mine: 'my monthly phone bill', gen: 'a phone bill', the: 'the bill', roleA: 'A customer', roleB: 'A customer service agent', place: 'At a telephone company' },
    { sit: 'accounting', mine: "the invoice from Atlas Office Supply", gen: 'a supplier invoice', the: 'the invoice', roleA: 'An accounts payable clerk', roleB: 'A supplier representative', place: 'At an office supply company' },
  ],
  opening: {
    1: [(v) => `Hi, I'm calling about ${v.inst.mine}. I think I've been charged twice.`, (v) => `Hello, I have a question about ${v.inst.mine}. The amount seems wrong.`],
    2: [(v) => `Hello, this is ${v.A.full}. I was going through ${v.inst.mine}, and there are two identical payments on the same day.`, (v) => `Hi. ${v.inst.mine.charAt(0).toUpperCase() + v.inst.mine.slice(1)} arrived this morning, and it's about twice what we usually pay.`],
    3: [(v) => `Hi, ${v.A.full} here. Our accountant flagged something during this month's review — she asked me to call you. It's about ${v.inst.mine}.`, (v) => `Good afternoon. I've been with you for years and never had an issue, which is why I was surprised when I opened ${v.inst.mine}.`],
  },
  bReply: [() => "I'm sorry about that. Let me take a look.", (v) => `Certainly, ${v.A.title}. Could you give me your account number?`, () => "I can help with that. One moment, please."],
  aDetail: (v) => `Sure. The charge is dated ${v.day} the ${['4th', '9th', '14th', '22nd'][v.A.first.length % 4]}, for ${['one hundred and twenty', 'two hundred and forty', 'eighty-five', 'three hundred'][v.B.last.length % 4]} dollars.`,
  detailQ: (v) => ({ stem: `What information does the ${man(v.A)} provide?`, answer: 'The date and amount of a charge', d: [o('A new mailing address', 'reasonable_but_unstated'), o("An accountant's name", 'true_but_irrelevant'), o('A password', 'reasonable_but_unstated')] }),
  purpose: () => 'To question a charge',
  purposeD: (v) => [o('To open a new account', 'reasonable_but_unstated'), o('To request a copy of a receipt', 'reasonable_but_unstated'), o(`To complain about an accountant`, 'keyword_overlap'), o(`To cancel ${v.inst.gen}`, 'reasonable_but_unstated')],
  topic: () => 'A billing problem',
  topicD: () => [o('A change in account ownership', 'reasonable_but_unstated'), o('A monthly financial review', 'true_but_irrelevant'), o('A new payment plan', 'reasonable_but_unstated')],
  comps: [
    {
      id: 'duplicate_pending',
      bLine: () => 'I see it. The second charge is actually a pending authorization, not a completed payment.',
      aReact: () => "Oh. So I haven't actually paid twice?",
      problem: () => 'One of the transactions has not been finalized.',
      problemD: () => [o('A payment was sent to the wrong account.', 'reasonable_but_unstated'), o('The account has been closed.', 'reasonable_but_unstated'), o('The card has expired.', 'reasonable_but_unstated')],
      intents: [
        {
          id: 'three_days',
          speaker: 'B',
          line: () => "Those usually disappear on their own within three days.",
          why: () => 'To reassure the listener that no action is needed',
          whyD: () => [o('To explain a new three-day policy', 'literal_interpretation'), o('To ask the listener to call back in three days', 'reasonable_but_unstated'), o('To warn that the charge will increase', 'opposite_meaning')],
          implies: () => 'The extra charge will be removed automatically.',
          impliesD: () => [o('The listener must pay a fee.', 'opposite_meaning'), o('The problem will take weeks to fix.', 'opposite_meaning'), o('The account will be locked for three days.', 'keyword_overlap')],
          reply: () => "That's a relief. I was worried I'd have to file a dispute.",
          indirect: 2,
          next: [
            { id: 'email_note', speaker: 'B', line: () => "I'll send you an e-mail confirming this, just so you have it in writing.", answer: () => 'Send a written confirmation', d: () => [o('File a dispute', 'keyword_overlap'), o('Issue a new card', 'reasonable_but_unstated'), o('Transfer the call', 'reasonable_but_unstated')] },
          ],
        },
      ],
    },
    {
      id: 'rate_changed',
      bLine: () => 'The rate went up at the start of this quarter. A notice was sent to all customers in March.',
      aReact: () => "I don't remember seeing any notice.",
      problem: () => 'A price was increased.',
      problemD: () => [o('A payment was missed.', 'reasonable_but_unstated'), o('A notice was returned.', 'keyword_overlap'), o('A discount was applied twice.', 'reasonable_but_unstated')],
      intents: [
        {
          id: 'annual_plan',
          speaker: 'B',
          line: () => 'Customers on the annual plan are still paying the old rate, though.',
          why: () => 'To suggest a way to pay less',
          whyD: () => [o('To describe other customers', 'literal_interpretation'), o('To explain why the notice was sent', 'reasonable_but_unstated'), o('To say that the rate will go up again', 'opposite_meaning')],
          implies: (v) => `The ${man(v.A)} could save money by switching plans.`,
          impliesD: () => [o('The annual plan is being discontinued.', 'reasonable_but_unstated'), o('The old rate is no longer available to anyone.', 'opposite_meaning'), o('The notice contained an error.', 'reasonable_but_unstated')],
          reply: () => "Really? How would I switch to that?",
          indirect: 2,
          next: [
            { id: 'switch_now', speaker: 'B', line: () => "I can change it for you right now — it'll take about two minutes.", answer: () => 'Change a service plan', d: () => [o('Resend a notice', 'keyword_overlap'), o('Refund a payment', 'reasonable_but_unstated'), o('Close an account', 'opposite_meaning')] },
          ],
        },
        {
          id: 'loyal_credit',
          speaker: 'A',
          line: (v) => `Well, I've recommended you to at least ${v.n} other businesses.`,
          why: () => 'To ask for special consideration',
          whyD: () => [o('To report how many customers he or she has', 'literal_interpretation'), o('To complain about poor service', 'reasonable_but_unstated'), o('To request a list of businesses', 'reasonable_but_unstated')],
          implies: () => 'The speaker hopes to receive a discount.',
          impliesD: () => [o('The speaker plans to cancel the service.', 'reasonable_but_unstated'), o('The other businesses were unhappy.', 'reasonable_but_unstated'), o('The speaker works for a competitor.', 'reasonable_but_unstated')],
          reply: () => "We really do appreciate that. Let me see what I can offer you.",
          indirect: 3,
          next: [
            { id: 'check_credit', speaker: 'B', line: () => "I'm going to check with my manager about a one-time credit.", answer: () => 'Ask a manager about a credit', d: () => [o('Raise the rate', 'opposite_meaning'), o('Contact other businesses', 'keyword_overlap'), o('Mail a new notice', 'true_but_irrelevant')] },
          ],
        },
      ],
    },
  ],
};

// ===========================================================================
// 10. Business travel arrangements
// ===========================================================================
const travelArrange: Goal = {
  id: 'travel_arr',
  isCall: false,
  instances: [
    { sit: 'travel', mine: 'the trip to the Singapore trade fair', gen: 'a business trip', the: 'the trip', roleA: 'A sales manager', roleB: 'A travel coordinator', place: 'At a company' },
    { sit: 'conference', mine: 'our travel to the Denver conference', gen: 'conference travel', the: 'the trip', roleA: 'A researcher', roleB: 'An administrative assistant', place: 'At a research institute' },
    { sit: 'airport', mine: 'my flight to the Lisbon office', gen: 'a flight', the: 'the flight', roleA: 'An executive', roleB: 'A travel agent', place: 'At a travel agency' },
    { sit: 'hotel', mine: 'the hotel rooms for the visiting clients', gen: 'hotel accommodations', the: 'the rooms', roleA: 'An office manager', roleB: 'A hotel reservations agent', place: 'At a hotel' },
    { sit: 'events', mine: 'the team retreat in the mountains', gen: 'a team retreat', the: 'the retreat', roleA: 'A department head', roleB: 'An event planner', place: 'At an event planning company' },
  ],
  opening: {
    1: [(v) => `${v.B.first}, I need to finalize ${v.inst.mine}. Can we go over the arrangements?`, (v) => `${v.B.first}, I'd like to book ${v.inst.mine} today if possible.`],
    2: [(v) => `${v.B.first}, the company just approved the budget for ${v.inst.mine}, so we can go ahead now.`, (v) => `${v.B.first}, I've got the dates for ${v.inst.mine} confirmed at last.`],
    3: [(v) => `${v.B.first}, my calendar has finally cleared for the second week of next month — which means ${v.inst.mine} is actually happening.`, (v) => `${v.B.first}, ${v.third.title} just stopped by my desk, and, well, it looks like ${v.inst.mine} is back on.`],
  },
  bReply: [() => "Great. What dates are we looking at?", () => "Sure. Do you have any preferences this time?", () => "OK. Let me open the booking system."],
  aDetail: (v) => `We'd leave on ${v.day} the 10th and come back on ${v.day2}. There will be ${v.n} of us.`,
  detailQ: (v) => ({ stem: 'How many people will travel?', answer: v.n.charAt(0).toUpperCase() + v.n.slice(1), d: [o('One', 'reasonable_but_unstated'), o('Two', 'reasonable_but_unstated'), o('Twenty', 'reasonable_but_unstated')].filter((x) => x.text.toLowerCase() !== v.n) }),
  purpose: (v) => `To make arrangements for ${v.inst.gen}`,
  purposeD: (v) => [o('To request time off', 'reasonable_but_unstated'), o('To approve a budget', 'true_but_irrelevant'), o(`To complain about ${v.inst.gen}`, 'keyword_overlap'), o('To cancel a reservation', 'reasonable_but_unstated')],
  topic: (v) => `Arranging ${v.inst.gen}`,
  topicD: () => [o('A budget review', 'true_but_irrelevant'), o('A client complaint', 'reasonable_but_unstated'), o('A new company policy', 'reasonable_but_unstated')],
  comps: [
    {
      id: 'hotel_full',
      bLine: () => "The hotel next to the venue is already fully booked for those dates.",
      aReact: () => "That's the one everyone recommended.",
      problem: () => 'The preferred accommodation is unavailable.',
      problemD: () => [o('The flights are too expensive.', 'reasonable_but_unstated'), o('The venue has changed.', 'keyword_overlap'), o('The dates are not confirmed.', 'opposite_meaning')],
      intents: [
        {
          id: 'shuttle',
          speaker: 'B',
          line: () => "There's a place about ten minutes away that runs a free shuttle every morning.",
          why: () => 'To propose an alternative',
          whyD: () => [o('To describe local transportation', 'literal_interpretation'), o('To recommend renting a car', 'reasonable_but_unstated'), o('To complain about the distance', 'opposite_meaning')],
          implies: () => 'Another hotel would still be convenient.',
          impliesD: () => [o('The venue is difficult to reach.', 'opposite_meaning'), o('The shuttle costs extra.', 'opposite_meaning'), o('The trip should be postponed.', 'reasonable_but_unstated')],
          reply: () => "That works. Ten minutes is nothing.",
          indirect: 1,
          next: [
            { id: 'book_rooms', speaker: 'B', line: () => "I'll reserve the rooms now before they fill up too.", answer: () => 'Make a hotel reservation', d: () => [o('Rent a car', 'reasonable_but_unstated'), o('Call the venue', 'keyword_overlap'), o('Change the travel dates', 'reasonable_but_unstated')] },
          ],
        },
        {
          id: 'airbnb_policy',
          speaker: 'A',
          line: () => "Hmm. Finance did say we could rent an apartment if it's cheaper.",
          why: () => 'To suggest a different type of accommodation',
          whyD: () => [o('To complain about the finance department', 'reasonable_but_unstated'), o('To ask about a new policy', 'literal_interpretation'), o('To reject the trip', 'opposite_meaning')],
          implies: () => 'An apartment could be an acceptable option.',
          impliesD: () => [o('The trip budget was reduced.', 'reasonable_but_unstated'), o('Apartments are not allowed.', 'opposite_meaning'), o('The hotel will lower its prices.', 'reasonable_but_unstated')],
          reply: () => "Oh, that could actually be better for a group.",
          indirect: 2,
          next: [
            { id: 'compare', speaker: 'B', line: () => "Let me put together a few options and send you a comparison this afternoon.", answer: () => 'Send some options for comparison', d: () => [o('Book a flight', 'reasonable_but_unstated'), o('Call the finance department', 'true_but_irrelevant'), o('Cancel the trip', 'opposite_meaning')] },
          ],
        },
      ],
    },
    {
      id: 'flight_times',
      bLine: () => "The only direct flight on that day leaves at six in the morning.",
      aReact: () => "Six? That means leaving home around three.",
      problem: () => 'A departure time is inconvenient.',
      problemD: () => [o('The flight has been canceled.', 'reasonable_but_unstated'), o('The airport is closed.', 'reasonable_but_unstated'), o('The tickets are sold out.', 'reasonable_but_unstated')],
      intents: [
        {
          id: 'connecting',
          speaker: 'B',
          line: () => "There's a connecting flight at noon, but it adds about three hours.",
          why: () => 'To present a trade-off',
          whyD: () => [o('To recommend the early flight', 'opposite_meaning'), o('To explain how connections work', 'literal_interpretation'), o('To say that no other flights exist', 'opposite_meaning')],
          implies: () => 'A later flight is possible but takes longer.',
          impliesD: () => [o('The noon flight is faster.', 'opposite_meaning'), o('The noon flight is fully booked.', 'reasonable_but_unstated'), o('The trip will be shortened by three hours.', 'keyword_overlap')],
          reply: () => "I'd honestly rather take the longer trip than get up at three.",
          indirect: 1,
          next: [
            { id: 'book_noon', speaker: 'B', line: () => "Understood. I'll book the noon flights for everyone.", answer: () => 'Book later flights', d: () => [o('Book the early flight', 'opposite_meaning'), o('Change the destination', 'reasonable_but_unstated'), o('Arrange a taxi at three', 'keyword_overlap')] },
          ],
        },
      ],
    },
  ],
};

// ===========================================================================
// 11. Onboarding a new employee
// ===========================================================================
const onboarding: Goal = {
  id: 'onboarding',
  isCall: false,
  instances: [
    { sit: 'hr', mine: "our new graphic designer's first day", gen: "a new employee's first day", the: 'the first day', roleA: 'A human resources assistant', roleB: 'A design team manager', place: 'At a company' },
    { sit: 'technology', mine: 'setting up the new developer who starts Monday', gen: "a new employee's setup", the: 'the setup', roleA: 'An IT technician', roleB: 'An engineering manager', place: 'At a technology company' },
    { sit: 'restaurant', mine: 'training the new line cook', gen: 'training a new staff member', the: 'the training', roleA: 'A head chef', roleB: 'A restaurant owner', place: 'At a restaurant' },
    { sit: 'retail', mine: 'the new cashiers starting this weekend', gen: 'new staff members', the: 'the new staff', roleA: 'A store supervisor', roleB: 'A store manager', place: 'At a store' },
    { sit: 'manufacturing', mine: 'the safety orientation for the new technicians', gen: 'a safety orientation', the: 'the orientation', roleA: 'A safety officer', roleB: 'A production manager', place: 'At a factory' },
  ],
  opening: {
    1: [(v) => `${v.B.first}, can we talk about ${v.inst.mine}? I want to make sure everything's ready.`, (v) => `${v.B.first}, I'm preparing for ${v.inst.mine}.`],
    2: [(v) => `${v.B.first}, I just realized ${v.inst.mine} is next week, and I haven't heard back about a few things.`, (v) => `${v.B.first}, I've drafted a schedule for ${v.inst.mine}, but there are a couple of gaps.`],
    3: [(v) => `${v.B.first}, remember what happened when the last new hire arrived and nobody had a desk ready? I'd like to avoid that with ${v.inst.mine}.`, (v) => `${v.B.first}, ${v.third.title} forwarded me an e-mail this morning — it's about ${v.inst.mine}.`],
  },
  bReply: [() => "Good idea. What's still missing?", () => "Sure. Where do things stand?", () => "Thanks for thinking ahead. What do you need from me?"],
  aDetail: (v) => `Well, the ID badge and uniform are ready, and orientation starts at ${v.time} on ${v.day}.`,
  detailQ: (v) => ({ stem: 'When will the orientation start?', answer: `At ${v.time}`, d: [o(`At ${v.time2}`, 'wrong_time'), o('At noon', 'reasonable_but_unstated'), o('After lunch', 'reasonable_but_unstated')] }),
  purpose: (v) => `To prepare for ${v.inst.gen}`,
  purposeD: () => [o('To schedule a job interview', 'reasonable_but_unstated'), o('To order new uniforms', 'true_but_irrelevant'), o('To complain about a coworker', 'reasonable_but_unstated'), o('To request a transfer', 'reasonable_but_unstated')],
  topic: (v) => `Preparing for ${v.inst.gen}`,
  topicD: () => [o('A uniform order', 'true_but_irrelevant'), o('An office party', 'reasonable_but_unstated'), o('A salary review', 'reasonable_but_unstated')],
  comps: [
    {
      id: 'no_mentor',
      bLine: () => "The only thing I'm unsure about is who'll show them around. I'm at a client site that whole day.",
      aReact: () => "Hmm, someone should really be there on day one.",
      problem: (v) => `The ${man(v.B)} will be unavailable.`,
      problemD: () => [o('The badge is not ready.', 'opposite_meaning'), o('The orientation was canceled.', 'reasonable_but_unstated'), o('The client site is closed.', 'keyword_overlap')],
      intents: [
        {
          id: 'volunteered',
          speaker: 'A',
          line: (v) => `${v.third.first} did say ${he(v.third)} enjoyed training people last year.`,
          why: (v) => `To suggest that ${v.third.first} could help`,
          whyD: (v) => [o(`To praise ${v.third.first}'s past work`, 'literal_interpretation'), o(`To ask whether ${v.third.first} is leaving`, 'reasonable_but_unstated'), o('To recommend hiring a trainer', 'reasonable_but_unstated')],
          implies: (v) => `${v.third.first} might be willing to guide the newcomer.`,
          impliesD: (v) => [o(`${v.third.first} is too busy.`, 'opposite_meaning'), o(`${v.third.first} was hired last year.`, 'keyword_overlap'), o('The training was unsuccessful.', 'reasonable_but_unstated')],
          reply: () => "Good thinking. Would you mind asking?",
          indirect: 2,
          next: [
            { id: 'ask_third', speaker: 'A', line: (v) => `Not at all. I'll catch ${v.third.first} after lunch.`, answer: (v) => `Speak with ${v.third.first}`, d: () => [o('Visit a client site', 'wrong_person'), o('Print an ID badge', 'true_but_irrelevant'), o('Reschedule the orientation', 'reasonable_but_unstated')] },
          ],
        },
      ],
    },
    {
      id: 'laptop_late',
      bLine: () => "The laptop we ordered won't arrive until the following Wednesday.",
      aReact: () => "So they'd have nothing to work on for the first few days.",
      problem: () => 'Some equipment will arrive late.',
      problemD: () => [o('The new employee has changed jobs.', 'reasonable_but_unstated'), o('The order was canceled.', 'reasonable_but_unstated'), o('The office is being renovated.', 'reasonable_but_unstated')],
      intents: [
        {
          id: 'spare',
          speaker: 'B',
          line: () => "Didn't we keep a couple of the old machines after the upgrade?",
          why: () => 'To suggest a temporary solution',
          whyD: () => [o('To check on an inventory list', 'literal_interpretation'), o('To complain about the upgrade', 'reasonable_but_unstated'), o('To propose canceling the order', 'reasonable_but_unstated')],
          implies: () => 'An older computer could be used in the meantime.',
          impliesD: () => [o('All old computers were thrown away.', 'opposite_meaning'), o('The upgrade failed.', 'reasonable_but_unstated'), o('The new laptop is defective.', 'reasonable_but_unstated')],
          reply: () => "You're right, there are two in the storage room.",
          indirect: 2,
          next: [
            { id: 'set_up_old', speaker: 'A', line: () => "I'll get one set up with the software this afternoon.", answer: () => 'Prepare a computer', d: () => [o('Order a new laptop', 'reasonable_but_unstated'), o('Clean the storage room', 'keyword_overlap'), o('Contact the new employee', 'reasonable_but_unstated')] },
          ],
        },
      ],
    },
  ],
};

// ===========================================================================
// 12. Vendor / contract negotiation
// ===========================================================================
const vendor: Goal = {
  id: 'vendor',
  isCall: false,
  instances: [
    { sit: 'contracts', mine: 'the cleaning contract that expires next month', gen: 'a service contract', the: 'the contract', roleA: 'A facilities manager', roleB: 'An operations director', place: 'At a company' },
    { sit: 'manufacturing', mine: 'renewing our agreement with the packaging supplier', gen: 'a supplier agreement', the: 'the agreement', roleA: 'A purchasing manager', roleB: 'A plant director', place: 'At a factory' },
    { sit: 'restaurant', mine: 'switching to a new produce supplier', gen: 'a supplier change', the: 'the supplier', roleA: 'A restaurant manager', roleB: 'A restaurant owner', place: 'At a restaurant' },
    { sit: 'technology', mine: 'the proposal from the new software vendor', gen: 'a vendor proposal', the: 'the proposal', roleA: 'An IT manager', roleB: 'A finance director', place: 'At a company' },
    { sit: 'marketing', mine: 'hiring an outside agency for the spring campaign', gen: 'an agency contract', the: 'the agency', roleA: 'A marketing manager', roleB: 'A company president', place: 'At a company' },
  ],
  opening: {
    1: [(v) => `${v.B.first}, we need to make a decision about ${v.inst.mine}.`, (v) => `${v.B.first}, I've looked into ${v.inst.mine} and wanted to share what I found.`],
    2: [(v) => `${v.B.first}, I got two quotes this week regarding ${v.inst.mine}, and they're quite different.`, (v) => `${v.B.first}, the deadline to respond about ${v.inst.mine} is ${v.day}.`],
    3: [(v) => `${v.B.first}, you know how we've been getting complaints lately? I think part of the answer is ${v.inst.mine}.`, (v) => `${v.B.first}, I had coffee with someone from ${v.company} yesterday, and it got me thinking about ${v.inst.mine}.`],
  },
  bReply: [() => "OK, what are our options?", () => "Good. I was hoping you'd bring that up.", () => "Sure. What's your recommendation?"],
  aDetail: () => 'The current company charges about fifteen percent more than the new one, but they know our needs well.',
  detailQ: () => ({ stem: 'What is mentioned about the current company?', answer: 'It is more expensive.', d: [o('It is new to the area.', 'opposite_meaning'), o('It has received complaints.', 'true_but_irrelevant'), o('It is going out of business.', 'reasonable_but_unstated')] }),
  purpose: () => 'To discuss choosing a business partner',
  purposeD: () => [o('To announce a price increase', 'reasonable_but_unstated'), o('To report customer complaints', 'true_but_irrelevant'), o('To plan a coffee meeting', 'keyword_overlap'), o('To hire a new employee', 'reasonable_but_unstated')],
  topic: (v) => `Deciding on ${v.inst.gen}`,
  topicD: () => [o('Customer complaints', 'true_but_irrelevant'), o('A holiday schedule', 'reasonable_but_unstated'), o('A new product launch', 'reasonable_but_unstated')],
  comps: [
    {
      id: 'reliability',
      bLine: () => "The cheaper one is new, though. I've never heard of them.",
      aReact: () => "That's my concern too.",
      problem: () => 'One option lacks a track record.',
      problemD: () => [o('Both companies are too expensive.', 'reasonable_but_unstated'), o('The contract has already expired.', 'reasonable_but_unstated'), o('The new company refused to negotiate.', 'reasonable_but_unstated')],
      intents: [
        {
          id: 'trial',
          speaker: 'A',
          line: () => "They did offer a three-month trial with no commitment.",
          why: () => 'To suggest a low-risk way to test the new company',
          whyD: () => [o('To describe the contract length', 'literal_interpretation'), o('To reject the new company', 'opposite_meaning'), o('To complain about long contracts', 'reasonable_but_unstated')],
          implies: () => 'The company could try the new vendor without much risk.',
          impliesD: () => [o('The trial has already ended.', 'reasonable_but_unstated'), o('A long commitment is required.', 'opposite_meaning'), o('The new company is expensive.', 'opposite_meaning')],
          reply: () => "That changes things. Let's give them a try.",
          indirect: 2,
          next: [
            { id: 'draft_trial', speaker: 'A', line: () => "Great. I'll let them know and ask for the trial paperwork.", answer: () => 'Contact the new vendor', d: () => [o('Renew the current contract', 'opposite_meaning'), o('Post a job opening', 'reasonable_but_unstated'), o('Review customer complaints', 'true_but_irrelevant')] },
          ],
        },
        {
          id: 'references',
          speaker: 'B',
          line: () => "I'd want to talk to a few of their clients first.",
          why: () => 'To request references before deciding',
          whyD: () => [o('To offer to find new clients', 'literal_interpretation'), o('To approve the contract immediately', 'opposite_meaning'), o('To suggest hiring a consultant', 'reasonable_but_unstated')],
          implies: () => 'More information is needed before choosing.',
          impliesD: () => [o('The decision has already been made.', 'opposite_meaning'), o('The new company has no clients.', 'reasonable_but_unstated'), o('The current company should be replaced now.', 'opposite_meaning')],
          reply: () => "Fair enough. I'll ask them for a list.",
          indirect: 2,
          next: [
            { id: 'request_refs', speaker: 'A', line: () => "I'll e-mail them for references today.", answer: () => 'Request references', d: () => [o('Sign a contract', 'opposite_meaning'), o('Visit the current vendor', 'reasonable_but_unstated'), o('Lower a budget', 'reasonable_but_unstated')] },
          ],
        },
      ],
    },
    {
      id: 'current_matches',
      bLine: () => "Have you told the current company about the other quote?",
      aReact: () => "Not yet. I wasn't sure it was worth it.",
      problem: () => 'The current company does not know about a competing offer.',
      problemD: () => [o('The quote contains a mistake.', 'reasonable_but_unstated'), o('The current company has closed.', 'reasonable_but_unstated'), o('The budget was rejected.', 'reasonable_but_unstated')],
      intents: [
        {
          id: 'matched_before',
          speaker: 'B',
          line: () => "They lowered their price for us once before, you know.",
          why: () => 'To suggest negotiating with the current company',
          whyD: () => [o('To recall a past mistake', 'literal_interpretation'), o('To recommend switching immediately', 'opposite_meaning'), o('To explain why prices rise', 'reasonable_but_unstated')],
          implies: () => 'The current company might offer a better price again.',
          impliesD: () => [o('The current company refuses to negotiate.', 'opposite_meaning'), o('Prices have always been low.', 'reasonable_but_unstated'), o('The new company is more reliable.', 'reasonable_but_unstated')],
          reply: () => "Good point. It can't hurt to ask.",
          indirect: 3,
          next: [
            { id: 'call_current', speaker: 'A', line: () => "I'll call their account manager this afternoon.", answer: () => 'Call the current company', d: () => [o('Sign with the new company', 'opposite_meaning'), o('Prepare a budget report', 'reasonable_but_unstated'), o('Ask for a second quote', 'keyword_overlap')] },
          ],
        },
      ],
    },
  ],
};

// ===========================================================================
// 13. Lost item / service follow-up
// ===========================================================================
const lostItem: Goal = {
  id: 'lost',
  isCall: true,
  instances: [
    { sit: 'hotel', mine: 'a laptop charger I think I left in my room', gen: 'a lost item', the: 'the charger', roleA: 'A former hotel guest', roleB: 'A hotel employee', place: 'At a hotel' },
    { sit: 'airport', mine: 'a bag that didn\'t arrive on my flight', gen: 'missing luggage', the: 'the bag', roleA: 'An airline passenger', roleB: 'An airline agent', place: 'At an airport' },
    { sit: 'restaurant', mine: 'a folder I left at your restaurant last night', gen: 'a lost item', the: 'the folder', roleA: 'A restaurant customer', roleB: 'A restaurant manager', place: 'At a restaurant' },
    { sit: 'conference', mine: 'a jacket I left in the main hall after the conference', gen: 'a lost item', the: 'the jacket', roleA: 'A conference attendee', roleB: 'A conference center employee', place: 'At a conference center' },
    { sit: 'travel', mine: 'an umbrella I left on the tour bus', gen: 'a lost item', the: 'the umbrella', roleA: 'A tourist', roleB: 'A tour company employee', place: 'At a tour company' },
  ],
  opening: {
    1: [(v) => `Hi, I'm calling to ask about ${v.inst.mine}.`, (v) => `Hello, I'm hoping you can help me find ${v.inst.mine}.`],
    2: [(v) => `Hello, this is ${v.A.full}. I got home yesterday and realized something was missing — ${v.inst.mine}.`, (v) => `Hi. I've looked everywhere at home and at the office, and I'm fairly sure it's ${v.inst.mine}.`],
    3: [(v) => `Hi, ${v.A.full} here. I have a big presentation tomorrow, and I just noticed a problem. It's about ${v.inst.mine}.`, (v) => `Good morning. This might be a long shot, but I have to ask — it's about ${v.inst.mine}.`],
  },
  bReply: [() => "Let me check our lost-and-found records.", () => "I'm sorry to hear that. Can you describe it?", () => "Of course. When were you here?"],
  aDetail: (v) => `It's black, with my name on a small label. I was there on ${v.day} evening.`,
  detailQ: () => ({ stem: 'What does the caller say about the item?', answer: 'It has a name label.', d: [o('It is red.', 'reasonable_but_unstated'), o('It was a gift.', 'reasonable_but_unstated'), o('It is very expensive.', 'reasonable_but_unstated')] }),
  purpose: (v) => `To ask about ${v.inst.gen}`,
  purposeD: () => [o('To make a reservation', 'reasonable_but_unstated'), o('To prepare for a presentation', 'true_but_irrelevant'), o('To complain about staff', 'reasonable_but_unstated'), o('To request a refund', 'reasonable_but_unstated')],
  topic: (v) => `Locating ${v.inst.gen}`,
  topicD: () => [o('A presentation', 'true_but_irrelevant'), o('A billing error', 'reasonable_but_unstated'), o('A job application', 'reasonable_but_unstated')],
  comps: [
    {
      id: 'found_elsewhere',
      bLine: () => "We do have something that matches, but it was sent to our main office downtown this morning.",
      aReact: () => "Downtown? That's on the other side of the city from me.",
      problem: () => 'The item has been moved to another location.',
      problemD: () => [o('The item was thrown away.', 'reasonable_but_unstated'), o('Nothing matching was found.', 'opposite_meaning'), o('The office is closed.', 'reasonable_but_unstated')],
      intents: [
        {
          id: 'courier',
          speaker: 'B',
          line: () => "A courier goes out that way every afternoon.",
          why: () => 'To offer to have the item delivered',
          whyD: () => [o('To describe a delivery schedule', 'literal_interpretation'), o('To recommend taking a taxi', 'reasonable_but_unstated'), o('To say that deliveries are not possible', 'opposite_meaning')],
          implies: () => 'The item could be sent to the caller.',
          impliesD: () => [o('The caller must pick it up in person.', 'opposite_meaning'), o('The courier lost the item.', 'reasonable_but_unstated'), o('The office moves every afternoon.', 'keyword_overlap')],
          reply: () => "Oh, that would be perfect. I'm happy to pay for it.",
          indirect: 2,
          next: [
            { id: 'take_address', speaker: 'B', line: () => "No charge. I'll just need your address.", answer: (v) => `Get the ${man(v.A)}'s address`, d: () => [o('Charge a delivery fee', 'opposite_meaning'), o('Call the main office', 'reasonable_but_unstated'), o('Describe the item', 'reasonable_but_unstated')] },
          ],
        },
      ],
    },
    {
      id: 'not_found_yet',
      bLine: () => "Nothing like that has been turned in yet, I'm afraid.",
      aReact: () => "Oh no. I really need it by tomorrow.",
      problem: () => 'The item has not been located.',
      problemD: () => [o('The item was damaged.', 'reasonable_but_unstated'), o('The item was sent to another city.', 'reasonable_but_unstated'), o('The item was claimed by someone else.', 'reasonable_but_unstated')],
      intents: [
        {
          id: 'cleaning_crew',
          speaker: 'B',
          line: () => "The cleaning crew hasn't handed in today's items yet.",
          why: () => 'To give the caller some hope',
          whyD: () => [o('To complain about the cleaning crew', 'reasonable_but_unstated'), o('To explain a cleaning schedule', 'literal_interpretation'), o('To say that the item is lost for good', 'opposite_meaning')],
          implies: () => 'The item might still turn up later today.',
          impliesD: () => [o('The cleaning crew threw the item away.', 'reasonable_but_unstated'), o('The item was found yesterday.', 'reasonable_but_unstated'), o('There is no chance of finding it.', 'opposite_meaning')],
          reply: () => "OK, so there's still a chance.",
          indirect: 2,
          next: [
            { id: 'call_back_evening', speaker: 'B', line: () => "I'll call you back before six either way.", answer: () => 'Return the call later', d: () => [o('Search the caller\'s office', 'reasonable_but_unstated'), o('Send a replacement', 'reasonable_but_unstated'), o('Talk to a manager', 'reasonable_but_unstated')] },
          ],
        },
      ],
    },
  ],
};

// ===========================================================================
// 14. Survey / sales results discussion
// ===========================================================================
const results: Goal = {
  id: 'results',
  isCall: false,
  instances: [
    { sit: 'marketing', mine: 'the customer survey results', gen: 'survey results', the: 'the results', roleA: 'A market researcher', roleB: 'A marketing director', place: 'At a marketing department' },
    { sit: 'retail', mine: "last month's sales figures for the new store", gen: 'sales figures', the: 'the figures', roleA: 'A regional manager', roleB: 'A store manager', place: 'At a retail company' },
    { sit: 'technology', mine: 'the user feedback on our app update', gen: 'user feedback', the: 'the feedback', roleA: 'A product manager', roleB: 'A software designer', place: 'At a technology company' },
    { sit: 'restaurant', mine: 'the reviews of our new lunch menu', gen: 'customer reviews', the: 'the reviews', roleA: 'A restaurant manager', roleB: 'A chef', place: 'At a restaurant' },
    { sit: 'training', mine: 'the feedback forms from the leadership workshop', gen: 'workshop feedback', the: 'the forms', roleA: 'A training coordinator', roleB: 'A workshop instructor', place: 'At a training center' },
  ],
  opening: {
    1: [(v) => `${v.B.first}, have you seen ${v.inst.mine}? I'd like to go over them with you.`, (v) => `${v.B.first}, ${v.inst.mine} just came in.`],
    2: [(v) => `${v.B.first}, I spent the morning with ${v.inst.mine}, and one number really stood out.`, (v) => `${v.B.first}, I've summarized ${v.inst.mine} for Thursday's meeting.`],
    3: [(v) => `${v.B.first}, remember our bet about the new design? Well, I think ${v.inst.mine} settles it.`, (v) => `${v.B.first}, I'm not sure whether to be pleased or worried after reading ${v.inst.mine}.`],
  },
  bReply: [() => "And? How do they look?", () => "Oh? Which part?", () => "I haven't had a chance yet. What did you find?"],
  aDetail: () => 'Overall satisfaction went up to eighty-two percent, which is the highest in three years.',
  detailQ: () => ({ stem: 'What does the speaker say about overall satisfaction?', answer: 'It reached a three-year high.', d: [o('It dropped slightly.', 'opposite_meaning'), o('It was not measured.', 'reasonable_but_unstated'), o('It stayed the same as last year.', 'reasonable_but_unstated')] }),
  purpose: (v) => `To discuss ${v.inst.gen}`,
  purposeD: () => [o('To settle a bet', 'true_but_irrelevant'), o('To plan a meeting agenda', 'keyword_overlap'), o('To request a budget increase', 'reasonable_but_unstated'), o('To introduce a new designer', 'reasonable_but_unstated')],
  topic: (v) => `Reviewing ${v.inst.gen}`,
  topicD: () => [o('A friendly bet', 'true_but_irrelevant'), o('A new hire', 'reasonable_but_unstated'), o('A holiday sale', 'reasonable_but_unstated')],
  comps: [
    {
      id: 'wait_times',
      bLine: () => "But the comments about wait times are still pretty negative.",
      aReact: () => "Yes, that's the one area that hasn't improved at all.",
      problem: () => 'Customers are unhappy about waiting.',
      problemD: () => [o('Prices are too high.', 'reasonable_but_unstated'), o('The survey had too few responses.', 'reasonable_but_unstated'), o('Satisfaction has fallen.', 'opposite_meaning')],
      intents: [
        {
          id: 'weekend_staff',
          speaker: 'A',
          line: () => "Almost all of those comments came in on weekends.",
          why: () => 'To point out the likely source of the problem',
          whyD: () => [o('To say that the survey was only on weekends', 'literal_interpretation'), o('To complain about weekend work', 'reasonable_but_unstated'), o('To suggest the problem is minor', 'opposite_meaning')],
          implies: () => 'More staff may be needed on weekends.',
          impliesD: () => [o('Weekday service is the problem.', 'opposite_meaning'), o('Customers only visit on weekends.', 'literal_interpretation'), o('The comments should be ignored.', 'reasonable_but_unstated')],
          reply: () => "Then maybe we just need more people on Saturdays and Sundays.",
          indirect: 2,
          next: [
            { id: 'check_schedule', speaker: 'B', line: () => "Let me look at the weekend schedule and see what we can adjust.", answer: () => 'Review a staff schedule', d: () => [o('Send another survey', 'reasonable_but_unstated'), o('Hire a consultant', 'reasonable_but_unstated'), o('Change the prices', 'reasonable_but_unstated')] },
          ],
        },
        {
          id: 'small_sample',
          speaker: 'B',
          line: () => "Only about forty people answered that question, though.",
          why: () => 'To suggest the result may not be reliable',
          whyD: () => [o('To report the total number of customers', 'literal_interpretation'), o('To say that the survey was a success', 'opposite_meaning'), o('To ask for the survey to be canceled', 'reasonable_but_unstated')],
          implies: () => 'The negative result might not reflect most customers.',
          impliesD: () => [o('Everyone complained about wait times.', 'opposite_meaning'), o('The survey was too long.', 'reasonable_but_unstated'), o('Forty staff members answered.', 'keyword_overlap')],
          reply: () => "Fair point. We could run a shorter follow-up survey.",
          indirect: 3,
          next: [
            { id: 'draft_followup', speaker: 'A', line: () => "I'll draft a few questions and send them to you tomorrow.", answer: () => 'Write survey questions', d: () => [o('Hire more staff', 'reasonable_but_unstated'), o('Present results to executives', 'reasonable_but_unstated'), o('Close on weekends', 'reasonable_but_unstated')] },
          ],
        },
      ],
    },
  ],
};

// ===========================================================================
// 15. Real estate: lease / office space
// ===========================================================================
const lease: Goal = {
  id: 'lease',
  isCall: true,
  instances: [
    { sit: 'real_estate', mine: 'renewing the lease on our office space', gen: 'a lease renewal', the: 'the lease', roleA: 'A business owner', roleB: 'A property manager', place: 'At a property management company' },
    { sit: 'real_estate', mine: 'the storefront for rent on Garden Street', gen: 'a rental property', the: 'the storefront', roleA: 'A shop owner', roleB: 'A real estate agent', place: 'At a real estate agency' },
    { sit: 'real_estate', mine: 'the warehouse unit you advertised online', gen: 'a warehouse rental', the: 'the unit', roleA: 'A logistics manager', roleB: 'A leasing agent', place: 'At a leasing office' },
    { sit: 'maintenance', mine: 'the repairs to our office building', gen: 'building repairs', the: 'the repairs', roleA: 'A tenant', roleB: 'A building manager', place: 'At a building management office' },
  ],
  opening: {
    1: [(v) => `Hi, I'm calling about ${v.inst.mine}.`, (v) => `Hello, I'd like to discuss ${v.inst.mine}.`],
    2: [(v) => `Hello, this is ${v.A.full} from ${v.company}. We're growing faster than expected, which brings me to ${v.inst.mine}.`, (v) => `Hi. I saw the notice you sent last week regarding ${v.inst.mine}, and I have some questions.`],
    3: [(v) => `Hi, ${v.A.full} here from ${v.company}. We hired ${v.n} new people this quarter, and, honestly, we're running out of desks. So I wanted to ask about ${v.inst.mine}.`, (v) => `Good morning. My business partner and I have been going back and forth all week, and we finally agreed on one thing — ${v.inst.mine}.`],
  },
  bReply: [() => "Of course. What would you like to know?", (v) => `Hello, ${v.A.title}. Happy to help.`, () => "Sure. Let me pull up the file."],
  aDetail: (v) => `We'd want to move in by the first of ${['March', 'June', 'September', 'November'][v.A.last.length % 4]}, and we need parking for at least ten cars.`,
  detailQ: () => ({ stem: 'What does the caller say the business needs?', answer: 'Parking spaces', d: [o('A loading dock', 'reasonable_but_unstated'), o('A new sign', 'reasonable_but_unstated'), o('Security cameras', 'reasonable_but_unstated')] }),
  purpose: (v) => `To inquire about ${v.inst.gen}`,
  purposeD: () => [o('To announce new hires', 'true_but_irrelevant'), o('To complain about a neighbor', 'reasonable_but_unstated'), o('To pay a late fee', 'reasonable_but_unstated'), o('To sell a building', 'reasonable_but_unstated')],
  topic: (v) => `${v.inst.gen.charAt(0).toUpperCase() + v.inst.gen.slice(1)}`,
  topicD: () => [o('Hiring new staff', 'true_but_irrelevant'), o('A parking ticket', 'keyword_overlap'), o('A business partnership', 'true_but_irrelevant')],
  comps: [
    {
      id: 'parking_limited',
      bLine: () => "The lot only has six spaces for that unit, unfortunately.",
      aReact: () => "Hmm. Six won't be nearly enough.",
      problem: () => 'There is not enough parking.',
      problemD: () => [o('The rent is too high.', 'reasonable_but_unstated'), o('The building is being sold.', 'reasonable_but_unstated'), o('The move-in date is too early.', 'reasonable_but_unstated')],
      intents: [
        {
          id: 'garage',
          speaker: 'B',
          line: () => "The public garage across the street offers monthly passes, though.",
          why: () => 'To suggest a way to get more parking',
          whyD: () => [o('To describe the neighborhood', 'literal_interpretation'), o('To say that parking is free', 'reasonable_but_unstated'), o('To recommend a different building', 'reasonable_but_unstated')],
          implies: () => 'Extra parking could be arranged nearby.',
          impliesD: () => [o('The garage is closing.', 'reasonable_but_unstated'), o('No other parking is available.', 'opposite_meaning'), o('The unit includes a garage.', 'keyword_overlap')],
          reply: () => "Oh, that could work if the price is reasonable.",
          indirect: 2,
          next: [
            { id: 'send_garage_info', speaker: 'B', line: () => "I'll e-mail you their rates along with the lease terms.", answer: () => 'Send some pricing information', d: () => [o('Show the unit in person', 'reasonable_but_unstated'), o('Lower the rent', 'reasonable_but_unstated'), o('Call the garage', 'keyword_overlap')] },
          ],
        },
      ],
    },
    {
      id: 'other_applicant',
      bLine: () => "I should mention that another company viewed the space yesterday.",
      aReact: () => '',
      problem: () => 'Someone else is interested in the property.',
      problemD: () => [o('The property has already been rented.', 'reasonable_but_unstated'), o('The viewing was canceled.', 'reasonable_but_unstated'), o('The price went up yesterday.', 'reasonable_but_unstated')],
      intents: [
        {
          id: 'deposit_today',
          speaker: 'A',
          line: () => "Well, I have my checkbook right here.",
          why: () => 'To show that he or she is ready to commit',
          whyD: () => [o('To ask about payment methods', 'literal_interpretation'), o('To request a lower price', 'reasonable_but_unstated'), o('To end the conversation', 'reasonable_but_unstated')],
          implies: () => 'The speaker is prepared to pay a deposit now.',
          impliesD: () => [o('The speaker needs more time to decide.', 'opposite_meaning'), o('The speaker lost a checkbook.', 'reasonable_but_unstated'), o('The speaker works for the other company.', 'reasonable_but_unstated')],
          reply: () => "In that case, I can hold it for you today.",
          indirect: 3,
          next: [
            { id: 'prepare_papers', speaker: 'B', line: () => "Let me prepare the paperwork while we talk.", answer: () => 'Prepare some documents', d: () => [o('Show the space to another company', 'true_but_irrelevant'), o('Raise the rent', 'reasonable_but_unstated'), o('Cancel the viewing', 'reasonable_but_unstated')] },
          ],
        },
      ],
    },
  ],
};

// ===========================================================================
// 16. Catering / large order
// ===========================================================================
const cateringOrder: Goal = {
  id: 'catering',
  isCall: true,
  instances: [
    { sit: 'restaurant', mine: 'a lunch order for our staff meeting on Friday', gen: 'a catering order', the: 'the order', roleA: 'An office assistant', roleB: 'A catering employee', place: 'At a catering company' },
    { sit: 'events', mine: 'desserts for a wedding reception', gen: 'a dessert order', the: 'the order', roleA: 'A wedding planner', roleB: 'A bakery owner', place: 'At a bakery' },
    { sit: 'retail', mine: 'a bulk order of printed T-shirts for a charity run', gen: 'a bulk order', the: 'the order', roleA: 'An event organizer', roleB: 'A print shop employee', place: 'At a print shop' },
    { sit: 'office', mine: 'flowers for the opening of our new branch', gen: 'a flower order', the: 'the flowers', roleA: 'A receptionist', roleB: 'A florist', place: 'At a flower shop' },
  ],
  opening: {
    1: [(v) => `Hi, I'd like to place ${v.inst.mine}.`, (v) => `Hello, I'm calling to arrange ${v.inst.mine}.`],
    2: [(v) => `Hi, this is ${v.A.full}. A colleague recommended you, and we need ${v.inst.mine}.`, (v) => `Hello. I'm organizing an event for about sixty people, and I'm looking for ${v.inst.mine}.`],
    3: [(v) => `Hi, ${v.A.full} here. Our usual supplier just told us they're fully booked, so I'm in a bit of a hurry. It's about ${v.inst.mine}.`, (v) => `Good afternoon. I was at an event you worked last month, and everyone's still talking about it — which is why I'm calling about ${v.inst.mine}.`],
  },
  bReply: [() => "We'd be happy to help. When do you need it?", () => "Great. How many people is it for?", () => "Sure. Let me take down some details."],
  aDetail: (v) => `It's for ${v.day} the 18th, and we'll need it delivered by ${v.time}.`,
  detailQ: (v) => ({ stem: 'By what time must the order be delivered?', answer: v.time, d: [o(v.time2, 'wrong_time'), o('Noon', 'reasonable_but_unstated'), o('The end of the day', 'reasonable_but_unstated')] }),
  purpose: (v) => `To place ${v.inst.gen}`,
  purposeD: () => [o('To complain about a supplier', 'true_but_irrelevant'), o('To cancel an event', 'reasonable_but_unstated'), o('To apply for a job', 'reasonable_but_unstated'), o('To ask about a refund', 'reasonable_but_unstated')],
  topic: (v) => `Ordering ${v.inst.gen.replace(/^an? /, '')}`,
  topicD: () => [o('A supplier problem', 'true_but_irrelevant'), o('A job interview', 'reasonable_but_unstated'), o('A delivery complaint', 'reasonable_but_unstated')],
  comps: [
    {
      id: 'minimum_notice',
      bLine: () => "Normally we ask for a week's notice for orders this size.",
      aReact: () => "Oh. That's only four days from now.",
      problem: () => 'The request is later than usual.',
      problemD: () => [o('The order is too small.', 'opposite_meaning'), o('The delivery address is wrong.', 'reasonable_but_unstated'), o('The shop is closing.', 'reasonable_but_unstated')],
      intents: [
        {
          id: 'simpler',
          speaker: 'B',
          line: () => "Our standard options are always ready faster, though.",
          why: () => 'To suggest a choice that can be delivered in time',
          whyD: () => [o('To advertise a new product line', 'literal_interpretation'), o('To refuse the order', 'opposite_meaning'), o('To explain the price', 'reasonable_but_unstated')],
          implies: () => 'A less customized order could be completed on time.',
          impliesD: () => [o('Standard options cost more.', 'reasonable_but_unstated'), o('The order cannot be completed.', 'opposite_meaning'), o('Custom orders are faster.', 'opposite_meaning')],
          reply: () => "That's fine — we don't need anything fancy.",
          indirect: 2,
          next: [
            { id: 'send_menu', speaker: 'B', line: () => "Then I'll e-mail you our standard catalog right now so you can choose.", answer: () => 'Send a catalog', d: () => [o('Visit the event site', 'reasonable_but_unstated'), o('Charge a rush fee', 'reasonable_but_unstated'), o('Call the usual supplier', 'true_but_irrelevant')] },
          ],
        },
      ],
    },
    {
      id: 'deposit',
      bLine: () => "We can do that. We just require a fifty percent deposit to confirm.",
      aReact: () => "I'll need approval for that.",
      problem: () => 'A partial payment is required in advance.',
      problemD: () => [o('The order must be picked up.', 'reasonable_but_unstated'), o('The date is unavailable.', 'reasonable_but_unstated'), o('The price has doubled.', 'reasonable_but_unstated')],
      intents: [
        {
          id: 'manager_away',
          speaker: 'A',
          line: () => "My manager is on a flight until this evening.",
          why: () => 'To explain a possible delay in confirming',
          whyD: () => [o('To mention a travel plan', 'literal_interpretation'), o('To request a later delivery', 'reasonable_but_unstated'), o('To cancel the order', 'opposite_meaning')],
          implies: () => 'Confirmation may not be possible until tonight.',
          impliesD: () => [o('The manager will pick up the order.', 'reasonable_but_unstated'), o('The deposit has already been paid.', 'opposite_meaning'), o('The manager rejected the order.', 'reasonable_but_unstated')],
          reply: () => "That's OK. I can hold the date until tomorrow noon.",
          indirect: 2,
          next: [
            { id: 'hold_date', speaker: 'B', line: () => "I'll send you a quote you can forward to her.", answer: () => 'Send a price quote', d: () => [o('Contact the manager directly', 'wrong_person'), o('Charge the deposit', 'reasonable_but_unstated'), o('Cancel the reservation', 'opposite_meaning')] },
          ],
        },
      ],
    },
  ],
};

export const GOALS_B: Goal[] = [billing, travelArrange, onboarding, vendor, lostItem, results, lease, cateringOrder];

// keep helpers referenced (tree-shaking friendly, avoids unused-import lint noise)
void him;
void his;
void He;
export type { CV };
