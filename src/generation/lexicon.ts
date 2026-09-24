/** Shared lexicon for procedural generation (names, companies, times, places). */
import type { Rng } from '../domain/rng';
import type { Accent } from '../domain/types';

export const MALE_FIRST = ['Daniel', 'Marcus', 'Kenji', 'Tomas', 'Ahmed', 'Victor', 'Owen', 'Rafael', 'Liam', 'Samuel', 'Hiroshi', 'Andre', 'Felix', 'Gregory', 'Nikhil', 'Paul', 'Ethan', 'Mateo', 'Jonah', 'Colin'];
export const FEMALE_FIRST = ['Priya', 'Hannah', 'Sofia', 'Mei', 'Claire', 'Amara', 'Julia', 'Naomi', 'Elena', 'Grace', 'Yuna', 'Fatima', 'Lucia', 'Rebecca', 'Ingrid', 'Olivia', 'Aisha', 'Chloe', 'Nadia', 'Tessa'];
export const LAST = ['Okafor', 'Lindqvist', 'Moreau', 'Tanaka', 'Castillo', 'Brennan', 'Adeyemi', 'Kowalski', 'Haddad', 'Pereira', 'Whitfield', 'Nakamura', 'Ferreira', 'Delgado', 'Hartmann', 'Osei', 'Sandoval', 'Rinaldi', 'Aldridge', 'Kaur', 'Novak', 'Esposito', 'Quinlan', 'Varga', 'Mbeki', 'Sorensen', 'Iyer', 'Laurent', 'Fitzgerald', 'Chandra'];

export const COMPANIES = [
  'Harlow Logistics', 'Brightline Media', 'Castell Engineering', 'Northgate Pharmaceuticals', 'Veridian Foods', 'Pinecrest Hotels',
  'Solano Textiles', 'Meridian Financial', 'Atlas Office Supply', 'Clearwater Consulting', 'Redwood Analytics', 'Kestrel Airlines',
  'Bluestone Properties', 'Orchid Cosmetics', 'Fairmont Printing', 'Summit Outdoor Gear', 'Lumen Software', 'Greenfield Catering',
  'Tidewater Shipping', 'Everly Furniture', 'Cobalt Electronics', 'Ridgeview Medical Supply', 'Maple & Finch Legal', 'Horizon Event Services',
];

export const CITIES = ['Toronto', 'Singapore', 'Melbourne', 'Denver', 'Lisbon', 'Osaka', 'Vancouver', 'Dublin', 'Chicago', 'Auckland', 'Rotterdam', 'Austin', 'Seoul', 'Hamburg'];
export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const TIMES = ['9:00', '9:30', '10:00', '10:30', '11:00', '1:00', '1:30', '2:00', '2:30', '3:00', '3:30', '4:00', '4:30'];
export const DEPARTMENTS = ['accounting', 'marketing', 'human resources', 'purchasing', 'customer service', 'research and development', 'legal', 'facilities', 'sales', 'IT'];
export const STREETS = ['Elm Street', 'Harbor Road', 'Lakeview Avenue', 'Mill Lane', 'Station Road', 'Kingsley Boulevard', 'Garden Street', 'Riverside Drive'];
export const NUMBERS_WORD = ['two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'ten', 'twelve', 'fifteen', 'twenty'];

export interface Person {
  first: string;
  last: string;
  gender: 'M' | 'W';
  title: string; // "Mr. Okafor"
  full: string;
  accent: Accent;
}

const ACCENTS: Accent[] = ['us', 'gb', 'au', 'ca'];

export function person(rng: Rng, gender: 'M' | 'W', avoid: string[] = []): Person {
  let first = '';
  let last = '';
  for (let i = 0; i < 10; i++) {
    first = rng.pick(gender === 'M' ? MALE_FIRST : FEMALE_FIRST);
    last = rng.pick(LAST);
    if (!avoid.includes(first) && !avoid.includes(last)) break;
  }
  return {
    first,
    last,
    gender,
    title: `${gender === 'M' ? 'Mr.' : 'Ms.'} ${last}`,
    full: `${first} ${last}`,
    accent: rng.pick(ACCENTS),
  };
}

export function otherDay(rng: Rng, day: string): string {
  return rng.pick(DAYS.filter((d) => d !== day));
}

export function laterTime(rng: Rng, t: string): string {
  const i = TIMES.indexOf(t);
  const later = TIMES.slice(i + 2);
  return later.length ? rng.pick(later) : '4:30';
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function article(word: string): string {
  return /^[aeiou]/i.test(word) && !/^(uni|use|eu|one)/i.test(word) ? 'an' : 'a';
}

/** Fill {slot} placeholders; throws if a slot is missing (caught by the critic). */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m));
}
