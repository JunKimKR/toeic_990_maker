/**
 * Offline simulation: N days of adaptive sessions with a synthetic learner.
 * Prints generation / novelty / distribution statistics. No network, no AI.
 *   npx tsx scripts/simulate.ts [days] [seed]
 */
import { simulateDays } from '../src/services/simulation';

const days = Number(process.argv[2] ?? 14);
const seed = Number(process.argv[3] ?? 7);
const r = simulateDays({ days, seed, minutes: 30 });
console.log(JSON.stringify(r.report, null, 2));
