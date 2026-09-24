/**
 * Session planner: turns the scheduler's per-skill time allocation into a
 * concrete TrainingBlueprint (ordered list of slots), optimising *expected
 * study time* rather than number of questions.
 *
 * Multi-item formats (Part 3/4 sets, Part 7 sets) train several skills at once,
 * so slot selection is a greedy knapsack: pick the unit that covers the most
 * remaining target-seconds per second of study time.
 */
import { allocate, computePriorities, SchedulerInput, STRONG_THRESHOLD } from './scheduler';
import { masteryFromTheta, targetDifficulty } from './skillModel';
import { SKILLS } from './skills';
import { createRng, Rng, uid } from './rng';
import type {
  BlueprintSlot,
  Difficulty,
  DisplayGroup,
  MistakeCause,
  Part,
  SkillId,
  TrainingBlueprint,
  TrainingMode,
} from './types';

export const SET_SKILLS: Partial<Record<Part, SkillId[]>> = {
  P3: [
    'extended_gist',
    'purpose_identification',
    'speaker_intent',
    'implied_meaning',
    'next_action_prediction',
    'extended_detail',
    'speaker_relationship',
    'location_context',
    'paraphrase_recognition',
  ],
  P4: [
    'extended_gist',
    'purpose_identification',
    'speaker_intent',
    'implied_meaning',
    'next_action_prediction',
    'extended_detail',
    'paraphrase_recognition',
    'location_context',
  ],
  P7: ['inference', 'specific_information', 'purpose', 'reference', 'paraphrase', 'multi_passage_synthesis', 'vocabulary', 'cross_sentence_connection'],
  P6: ['cross_sentence_connection', 'text_structure', 'grammar', 'vocabulary'],
};

export const SINGLE_SKILLS: Partial<Record<Part, SkillId[]>> = {
  P2: ['short_gist', 'indirect_response', 'negative_question', 'short_detail', 'implied_meaning'],
  P5: ['grammar', 'vocabulary', 'time_pressure_accuracy'],
  VOC: ['vocabulary', 'paraphrase'],
};

export function partCanTrain(part: Part, skill: SkillId): boolean {
  return (SET_SKILLS[part] ?? SINGLE_SKILLS[part] ?? []).includes(skill);
}

const SET_SIZE: Partial<Record<Part, number>> = { P3: 3, P4: 3, P6: 2, P7: 3 };

/** Seconds a unit takes (answering + reviewing explanations). */
export function unitSeconds(part: Part, mode: TrainingMode, items = SET_SIZE[part] ?? 1): number {
  const training = mode === 'training';
  switch (part) {
    case 'P2':
      return training ? 36 : 22;
    case 'P3':
    case 'P4':
      // ~35-45s audio + ~18s/item answering + review; training adds a thinking item
      return training ? 45 + items * 30 + 25 : 40 + items * 18;
    case 'P5':
      return training ? 32 : 22;
    case 'VOC':
      return training ? 32 : 22;
    case 'P6':
      return training ? 50 + items * 30 : 40 + items * 22;
    case 'P7':
      return training ? 60 + items * 32 : 50 + items * 25;
  }
}

export interface PlannerInput extends SchedulerInput {
  mode: TrainingMode;
  weakVocab?: string[];
  topCauses?: Partial<Record<SkillId, MistakeCause>>;
  seed?: number;
}

interface Candidate {
  part: Part;
  primary: SkillId;
  itemSkills: SkillId[];
  seconds: number;
}

export function buildBlueprint(input: PlannerInput): TrainingBlueprint {
  if (input.mode === 'exam') return buildExamBlueprint(input);
  const rng = createRng(input.seed ?? input.now);
  const priorities = computePriorities(input);
  const alloc = allocate(input, priorities);
  const mastery = (s: SkillId) => masteryFromTheta(input.states[s].theta);
  const remaining = new Map<SkillId, number>();
  const difficultyOf = new Map<SkillId, Difficulty>();
  const maintSkills = new Set(alloc.maintenance.map((m) => m.skill));
  for (const a of [...alloc.focus, ...alloc.maintenance]) {
    remaining.set(a.skill, (remaining.get(a.skill) ?? 0) + a.targetSeconds);
    difficultyOf.set(a.skill, a.targetDifficulty);
  }
  const diff = (s: SkillId): Difficulty =>
    difficultyOf.get(s) ?? targetDifficulty(input.states[s], 0.68, input.difficultyBias ?? 0);

  const budget = input.budgetSeconds - alloc.challenge.seconds;
  const slots: BlueprintSlot[] = [];
  let total = 0;
  const partHistory: Part[] = [];

  const makeCandidates = (): Candidate[] => {
    const out: Candidate[] = [];
    for (const [skill, rem] of remaining) {
      if (rem <= 5) continue;
      for (const part of SKILLS[skill].formats.slice(0, 2)) {
        const setSkills = SET_SKILLS[part];
        if (setSkills) {
          const n = SET_SIZE[part] ?? 3;
          const companions = setSkills
            .filter((s) => s !== skill && (remaining.get(s) ?? 0) > 5)
            .sort((a, b) => (remaining.get(b) ?? 0) - (remaining.get(a) ?? 0))
            .slice(0, n - 1);
          // fill up with a detail item (natural in real sets; cheap maintenance)
          const filler: SkillId = part === 'P7' || part === 'P6' ? 'specific_information' : 'extended_detail';
          while (companions.length < n - 1) companions.push(filler);
          out.push({ part, primary: skill, itemSkills: [skill, ...companions], seconds: unitSeconds(part, input.mode, n) });
        } else {
          out.push({ part, primary: skill, itemSkills: [skill], seconds: unitSeconds(part, input.mode, 1) });
        }
      }
    }
    return out;
  };

  const score = (c: Candidate): number => {
    const per = c.seconds / c.itemSkills.length;
    let useful = 0;
    const used = new Map<SkillId, number>();
    for (const s of c.itemSkills) {
      const left = (remaining.get(s) ?? 0) - (used.get(s) ?? 0);
      const u = Math.max(0, Math.min(left, per));
      useful += u;
      used.set(s, (used.get(s) ?? 0) + per);
    }
    let sc = useful / c.seconds;
    // variety: avoid the same format three times in a row
    const lastTwo = partHistory.slice(-2);
    if (lastTwo.length === 2 && lastTwo.every((p) => p === c.part)) sc *= 0.7;
    // format diversity for equally useful sets (P3 vs P4 both train intent/gist)
    const sameCount = partHistory.filter((p) => p === c.part).length;
    sc *= 1 - Math.min(0.3, 0.05 * sameCount);
    // content capacity: the offline Part 4 grammar is smaller than Part 3's,
    // so prefer P3 slightly when both train the same skills (TOEIC ratio is ~13:10 anyway)
    if (c.part === 'P4') sc *= 0.88;
    // small preference for the primary skill's own remaining share
    sc += 0.05 * Math.min(1, (remaining.get(c.primary) ?? 0) / 120);
    return sc;
  };

  let guard = 0;
  while (total < budget * 0.96 && guard++ < 200) {
    const cands = makeCandidates().filter((c) => total + c.seconds <= budget * 1.1);
    if (cands.length === 0) break;
    cands.sort((a, b) => score(b) - score(a));
    const best = cands[0];
    if (score(best) < 0.2) break;
    const per = best.seconds / best.itemSkills.length;
    for (const s of best.itemSkills) remaining.set(s, (remaining.get(s) ?? 0) - per);
    total += best.seconds;
    partHistory.push(best.part);
    const isMaint = maintSkills.has(best.primary) || mastery(best.primary) >= STRONG_THRESHOLD;
    slots.push({
      id: uid('slot'),
      part: best.part,
      skill: best.primary,
      difficulty: diff(best.primary),
      group: isMaint ? 'maintenance' : SKILLS[best.primary].group,
      estimatedSeconds: best.seconds,
      itemSkills: best.itemSkills.length > 1 ? best.itemSkills : undefined,
      focusCause: input.topCauses?.[best.primary],
      reason: reasonFor(best.primary, alloc.focus.find((f) => f.skill === best.primary)?.reasons, isMaint),
    });
  }

  // --- challenge items (difficulty 5, single-item formats) ---
  const challengeSkills = alloc.challenge.skills;
  let chSeconds = alloc.challenge.seconds;
  let ci = 0;
  while (chSeconds > 15 && ci < 6) {
    const skill = challengeSkills[ci % Math.max(1, challengeSkills.length)] ?? 'grammar';
    const { part, s } = singleFormatFor(skill, rng);
    const sec = unitSeconds(part, input.mode, 1);
    slots.push({
      id: uid('slot'),
      part,
      skill: s,
      difficulty: 5,
      group: 'challenge',
      estimatedSeconds: sec,
      isChallenge: true,
      reason: '990 Challenge: 최고 난도에서 한계 확인',
    });
    chSeconds -= sec;
    total += sec;
    ci++;
  }

  // --- vocabulary targets: attach weak words to vocab slots (spaced) ---
  const weak = (input.weakVocab ?? []).slice();
  for (const sl of slots) {
    if ((sl.part === 'VOC' || (sl.part === 'P5' && sl.skill === 'vocabulary')) && weak.length) {
      sl.vocabTargets = [weak.shift()!];
    }
  }

  const ordered = orderSlots(slots);
  const groupCounts: Partial<Record<DisplayGroup, number>> = {};
  for (const sl of ordered) {
    const skills = sl.itemSkills ?? [sl.skill];
    for (const s of skills) {
      const g: DisplayGroup = sl.isChallenge
        ? 'challenge'
        : mastery(s) >= STRONG_THRESHOLD || maintSkills.has(s)
          ? 'maintenance'
          : SKILLS[s].group;
      groupCounts[g] = (groupCounts[g] ?? 0) + 1;
    }
  }

  return {
    id: uid('bp'),
    createdAt: input.now,
    mode: input.mode,
    budgetSeconds: input.budgetSeconds,
    estimatedSeconds: total,
    slots: ordered,
    allocations: [...alloc.focus, ...alloc.maintenance],
    groupCounts,
    bottlenecks: alloc.bottlenecks,
    decisions: alloc.decisions,
  };
}

function reasonFor(skill: SkillId, reasons: string[] | undefined, maint: boolean): string {
  if (maint) return `${SKILLS[skill].labelKo} 강점 유지`;
  return reasons?.[0] ?? `${SKILLS[skill].labelKo} 집중 훈련`;
}

export function singleFormatFor(skill: SkillId, rng: Rng): { part: Part; s: SkillId } {
  if (partCanTrain('P2', skill)) return { part: 'P2', s: skill };
  if (partCanTrain('P5', skill)) return { part: 'P5', s: skill };
  if (partCanTrain('VOC', skill)) return { part: 'VOC', s: skill };
  if (SKILLS[skill].section === 'LC') {
    // intent/gist skills -> Part 2 indirect/implied items are the single-item analogue
    return { part: 'P2', s: rng.chance(0.5) ? 'indirect_response' : 'implied_meaning' };
  }
  return { part: 'P5', s: rng.chance(0.5) ? 'grammar' : 'vocabulary' };
}

type Lane = 'lcset' | 'p2' | 'rcshort' | 'rclong';
const laneOf = (p: Part): Lane =>
  p === 'P3' || p === 'P4' ? 'lcset' : p === 'P2' ? 'p2' : p === 'P5' || p === 'VOC' ? 'rcshort' : 'rclong';

/**
 * Interleave formats: the bottleneck (LC sets) comes early while attention is
 * fresh, short RC items act as breaks, challenge items form the finale.
 */
export function orderSlots(slots: BlueprintSlot[]): BlueprintSlot[] {
  const challenge = slots.filter((s) => s.isChallenge);
  const rest = slots.filter((s) => !s.isChallenge);
  const lanes: Record<Lane, BlueprintSlot[]> = { lcset: [], p2: [], rcshort: [], rclong: [] };
  for (const s of rest) lanes[laneOf(s.part)].push(s);
  const pattern: Lane[] = ['lcset', 'p2', 'rcshort', 'rcshort', 'lcset', 'p2', 'rcshort', 'rclong'];
  const out: BlueprintSlot[] = [];
  let i = 0;
  while (out.length < rest.length) {
    const lane = pattern[i % pattern.length];
    const next = lanes[lane].shift();
    if (next) out.push(next);
    i++;
    if (i > 10_000) break;
  }
  return [...out, ...challenge];
}

// ---------------------------------------------------------------------------
// EXAM MODE: realistic mini-mock (same proportions as TOEIC, timed)
// ---------------------------------------------------------------------------

export function buildExamBlueprint(input: PlannerInput): TrainingBlueprint {
  const rng = createRng(input.seed ?? input.now);
  const scale = input.budgetSeconds / 1800;
  const n = (x: number) => Math.max(1, Math.round(x * scale));
  const slots: BlueprintSlot[] = [];
  const diffMix = (): Difficulty => rng.weighted([2, 3, 4, 5] as Difficulty[], (d) => ({ 2: 1, 3: 3, 4: 4, 5: 2 })[d as 2 | 3 | 4 | 5]);
  const add = (part: Part, skill: SkillId, itemSkills?: SkillId[]) => {
    slots.push({
      id: uid('slot'),
      part,
      skill,
      difficulty: diffMix(),
      group: SKILLS[skill].group,
      estimatedSeconds: unitSeconds(part, 'exam', itemSkills?.length ?? 1),
      itemSkills,
      reason: 'Mini mock',
    });
  };
  const p2Skills: SkillId[] = ['short_gist', 'indirect_response', 'negative_question', 'short_detail', 'implied_meaning'];
  for (let i = 0; i < n(7); i++) add('P2', p2Skills[i % p2Skills.length]);
  const p3Combos: SkillId[][] = [
    ['purpose_identification', 'extended_detail', 'next_action_prediction'],
    ['speaker_relationship', 'speaker_intent', 'extended_detail'],
    ['extended_gist', 'implied_meaning', 'next_action_prediction'],
  ];
  for (let i = 0; i < n(2); i++) add('P3', p3Combos[i % 3][0], p3Combos[i % 3]);
  const p4Combos: SkillId[][] = [
    ['purpose_identification', 'speaker_intent', 'next_action_prediction'],
    ['extended_gist', 'extended_detail', 'implied_meaning'],
  ];
  for (let i = 0; i < n(2); i++) add('P4', p4Combos[i % 2][0], p4Combos[i % 2]);
  for (let i = 0; i < n(10); i++) add('P5', i % 5 < 3 ? 'grammar' : 'vocabulary');
  add('P6', 'cross_sentence_connection', ['cross_sentence_connection', 'grammar']);
  add('P7', 'inference', ['purpose', 'specific_information', 'inference']);
  const total = slots.reduce((s, x) => s + x.estimatedSeconds, 0);
  // keep TOEIC order in exam mode: LC first, then RC
  const orderIdx: Record<Part, number> = { P2: 0, P3: 1, P4: 2, P5: 3, P6: 4, P7: 5, VOC: 6 };
  slots.sort((a, b) => orderIdx[a.part] - orderIdx[b.part]);
  const groupCounts: Partial<Record<DisplayGroup, number>> = {};
  for (const s of slots) groupCounts[s.group] = (groupCounts[s.group] ?? 0) + (s.itemSkills?.length ?? 1);
  return {
    id: uid('bp'),
    createdAt: input.now,
    mode: 'exam',
    budgetSeconds: input.budgetSeconds,
    estimatedSeconds: total,
    slots,
    allocations: [],
    groupCounts,
    bottlenecks: computePriorities(input).filter((p) => !p.strong).slice(0, 3).map((p) => p.skill),
    decisions: ['EXAM MODE: 실제 시험 비율의 미니 모의고사'],
  };
}
