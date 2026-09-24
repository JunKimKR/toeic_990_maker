/** Part 3 conversation generator (goal × instance × complication × intent × next action). */
import { clamp } from '../../domain/rng';
import type { Difficulty, Question, QuestionItem, ScriptLine, SkillId, Speaker } from '../../domain/types';
import { finalizeQuestion, makeItem } from '../build';
import { CV, GOALS as GOALS_A, Goal, Inst, Intent, man, he, NextAct, Complication } from '../content/part3Goals';
import { GOALS_B } from '../content/part3GoalsB';

const GOALS: Goal[] = [...GOALS_A, ...GOALS_B];
import { freshWeight, GenContext, situationWeight } from '../genTypes';
import { CITIES, COMPANIES, DAYS, DEPARTMENTS, NUMBERS_WORD, person, TIMES } from '../lexicon';
import { distinctFrom, mergeTurns, OptLike, pickAccents, pickDistractors, relabel, scriptSeconds, toRaw, TYPE_KO } from './lcCommon';

const kindOf = (i: Inst) => i.kind ?? 'default';

interface Path {
  goal: Goal;
  comp: Complication;
  intent: Intent;
  next: NextAct;
  id: string;
}

function allPaths(goal: Goal, inst: Inst): Path[] {
  const out: Path[] = [];
  for (const comp of goal.comps) {
    if (comp.kinds && !comp.kinds.includes(kindOf(inst))) continue;
    for (const intent of comp.intents) {
      if (intent.kinds && !intent.kinds.includes(kindOf(inst))) continue;
      for (const next of intent.next) out.push({ goal, comp, intent, next, id: `p3.${goal.id}.${comp.id}.${intent.id}.${next.id}` });
    }
  }
  return out;
}

const INTENT_SKILLS: SkillId[] = ['speaker_intent', 'implied_meaning'];

export function generateP3(ctx: GenContext): Question | null {
  const { rng, slot, novelty } = ctx;
  const d = slot.difficulty;
  // desired indirectness of the intent line: d<=3 -> 1-2, d4 -> 2, d5 -> 3
  const wantIndirect = d >= 5 ? 3 : d >= 4 ? 2 : 1.5;

  // ---- choose goal + instance + path with novelty weights ----
  const candidates: { goal: Goal; inst: Inst; path: Path; w: number }[] = [];
  for (const goal of GOALS) {
    for (const inst of goal.instances) {
      const sw = situationWeight(inst.sit, novelty);
      for (const path of allPaths(goal, inst)) {
        const w =
          sw *
          freshWeight(novelty.reasoningCounts.get(path.id)) *
          freshWeight(novelty.templateCounts.get(`p3i:${goal.id}:${inst.mine}`)) *
          (1 / (1 + Math.abs(path.intent.indirect - wantIndirect)));
        candidates.push({ goal, inst, path, w });
      }
    }
  }
  if (!candidates.length) return null;
  const pick = rng.weighted(candidates, (c) => c.w);
  const { goal, inst, path } = pick;

  // ---- variables ----
  const aGender = rng.chance(0.5) ? 'M' : 'W';
  const A = person(rng, aGender);
  const B = person(rng, aGender === 'M' ? 'W' : 'M', [A.first, A.last]);
  const third = person(rng, rng.chance(0.5) ? 'M' : 'W', [A.first, A.last, B.first, B.last]);
  const days = rng.shuffle(DAYS);
  const t1 = rng.pick(TIMES.slice(0, 8));
  const v: CV = {
    A,
    B,
    inst,
    day: days[0],
    day2: days[1],
    day3: days[2],
    time: t1,
    time2: rng.pick(TIMES.slice(8)),
    city: rng.pick(CITIES),
    company: rng.pick(COMPANIES),
    dept: rng.pick(DEPARTMENTS),
    n: rng.pick(NUMBERS_WORD.slice(3, 8)),
    third,
  };
  // day3 must be the day after day2 for "only a day later" lines
  const i2 = DAYS.indexOf(v.day2);
  if (i2 >= 0 && i2 < 4) v.day3 = DAYS[i2 + 1];
  else {
    v.day2 = DAYS[rng.int(0, 3)];
    v.day3 = DAYS[DAYS.indexOf(v.day2) + 1];
  }
  if (v.day === v.day2 || v.day === v.day3) v.day = DAYS.find((x) => x !== v.day2 && x !== v.day3)!;

  // ---- opening tier (gist difficulty) ----
  const gistPrimary = slot.skill === 'extended_gist' || slot.skill === 'purpose_identification';
  const tier: 1 | 2 | 3 = gistPrimary ? (d >= 5 ? 3 : d >= 4 ? rng.pick([2, 3]) : d >= 3 ? 2 : 1) : d >= 4 ? rng.pick([2, 3]) : rng.pick([1, 2]);
  const openings = goal.opening[tier].map((f) => f(v)).filter(Boolean);
  const opening = openings.length ? rng.pick(openings) : goal.opening[1][0](v);

  const spk = (who: 'A' | 'B'): Speaker => ((who === 'A' ? A : B).gender === 'M' ? 'M' : 'W');
  const [accA, accB] = pickAccents(rng);
  const L = (who: 'A' | 'B', text: string): ScriptLine => ({ speaker: spk(who), text, accent: who === 'A' ? accA : accB });

  const { comp, intent, next } = path;
  const intentLine = intent.line(v);
  const raw: ScriptLine[] = [L('A', opening), L('B', rng.pick(goal.bReply)(v)), L('A', goal.aDetail(v)), L('B', comp.bLine(v))];
  const react = comp.aReact(v);
  if (intent.speaker === 'B' && react) raw.push(L('A', react));
  raw.push(L(intent.speaker, intentLine));
  const replier: 'A' | 'B' = intent.speaker === 'A' ? 'B' : 'A';
  raw.push(L(replier, intent.reply(v)));
  raw.push(L(next.speaker, next.line(v)));
  const script = mergeTurns(raw);
  const scriptText = script.map((l) => l.text).join(' ');
  const lineIndex = (needle: string) => script.findIndex((l) => l.text.includes(needle));

  // ---- items ----
  const requested = (slot.itemSkills ?? [slot.skill, 'extended_detail', 'next_action_prediction']).slice(0, 3);
  const used = new Set<string>();
  const items: { order: number; item: QuestionItem }[] = [];
  const S = intent.speaker === 'A' ? A : B;
  const intentD: Difficulty = clamp(intent.indirect + 2, 2, 5) as Difficulty;
  const gistD: Difficulty = clamp(tier + 2 + (d >= 5 ? 1 : 0), 2, 5) as Difficulty;

  const mk = (order: number, skill: SkillId, stem: string, correct: string, opts: OptLike[], diff: Difficulty, short: string, detail: string, evidence: number[], extra: Partial<QuestionItem> = {}) => {
    const ds = pickDistractors(rng, opts.map((o) => relabel(o, scriptText)), 3, diff, correct);
    if (ds.length < 3) return false;
    const item = makeItem(ctx, {
      stem,
      raw: toRaw(correct, ds, (o) => `${o.text}: ${TYPE_KO[o.type]}`),
      skill,
      subskill: `p3_${skill}`,
      difficulty: diff,
      short,
      detail,
      evidenceLines: evidence.filter((i) => i >= 0),
      quotedLine: extra.quotedLine,
      trainingOnly: extra.trainingOnly,
      secondarySkills: extra.secondarySkills,
    });
    items.push({ order, item });
    return true;
  };

  const addSkill = (skill: SkillId): boolean => {
    switch (skill) {
      case 'extended_gist':
        if (used.has('gist')) return false;
        used.add('gist');
        return mk(0, 'extended_gist', 'What are the speakers mainly discussing?', goal.topic(v), goal.topicD(v), gistD,
          `대화 전체의 주제: ${goal.topic(v)}.`,
          `첫 발화의 세부(날짜·장소·사람)가 아니라 대화가 무엇을 해결하려 하는지 보세요. ${tier >= 2 ? '이 대화는 목적을 직접 말하지 않고 상황으로 드러냅니다.' : ''} 언급된 세부 정보를 주제로 고르게 만드는 것이 대표 함정입니다.`,
          [0, 2]);
      case 'purpose_identification':
        if (used.has('gist')) return false;
        used.add('gist');
        return mk(0, 'purpose_identification', goal.isCall ? `Why is the ${man(A)} calling?` : 'What is the purpose of the conversation?', goal.purpose(v), goal.purposeD(v), gistD,
          `목적: ${goal.purpose(v)}.`,
          `${tier === 1 ? '첫 문장에서 목적을 직접 밝힙니다.' : tier === 2 ? '목적이 직접 언급되지 않습니다. 첫 두 발화의 상황(일정 충돌·지연 등)을 종합해야 합니다.' : '첫 발화는 배경 이야기처럼 들리지만, 대화가 향하는 방향(무엇을 요청하는지)이 목적입니다.'} 대화 중에 언급된 세부 정보를 목적으로 착각하지 마세요.`,
          [0, 1, 2]);
      case 'speaker_intent':
        if (used.has('intent')) return false;
        used.add('intent');
        return mk(3, 'speaker_intent', `Why does the ${man(S)} say, "${intentLine}"?`, intent.why(v), intent.whyD(v), intentD,
          `이 말의 기능: ${intent.why(v)}.`,
          `인용문의 표면 의미가 아니라 직전 발화(${comp.bLine(v).slice(0, 60)}…)에 대한 반응으로서 "왜" 말했는지를 봅니다. 이어지는 상대의 반응 "${intent.reply(v)}"가 해석을 확인해 줍니다.`,
          [lineIndex(intentLine), lineIndex(intentLine) - 1, lineIndex(intentLine) + 1], { quotedLine: intentLine });
      case 'implied_meaning':
        if (used.has('intent')) return false;
        used.add('intent');
        return mk(3, 'implied_meaning', `What does the ${man(S)} imply when ${he(S)} says, "${intentLine}"?`, intent.implies(v), intent.impliesD(v), intentD,
          `함축: ${intent.implies(v)}`,
          `화자는 직접 말하지 않고 돌려서 전달합니다. 문장 그대로의 의미(표면 해석)를 고르는 것이 가장 흔한 오답입니다. 상대의 반응 "${intent.reply(v)}"가 함축을 확인해 줍니다.`,
          [lineIndex(intentLine), lineIndex(intentLine) + 1], { quotedLine: intentLine });
      case 'next_action_prediction': {
        if (used.has('next')) return false;
        used.add('next');
        const who = next.speaker === 'A' ? A : B;
        const ans = next.answer(v);
        const stem = /^The (man|woman) /.test(ans) ? 'What will most likely happen next?' : `What will the ${man(who)} most likely do next?`;
        return mk(4, 'next_action_prediction', stem, ans, next.d(v), clamp(d, 3, 4) as Difficulty,
          `마지막 발화: "${next.line(v)}"`,
          `다음 행동 문제는 거의 항상 마지막 한두 문장에 근거가 있습니다. 정답은 그 문장을 다른 말로 바꿔 표현(패러프레이즈)합니다.`,
          [script.length - 1]);
      }
      case 'extended_detail': {
        if (used.has('detail')) return false;
        used.add('detail');
        const dq = goal.detailQ(v);
        return mk(1, 'extended_detail', dq.stem, dq.answer, dq.d, 3, `근거: "${goal.aDetail(v)}"`, '세부 정보 문제는 질문의 키워드(요일, 장소 등)를 미리 보고 해당 부분을 기다리면 됩니다.', [lineIndex(goal.aDetail(v).slice(0, 20))]);
      }
      case 'paraphrase_recognition': {
        if (used.has('problem')) return false;
        used.add('problem');
        return mk(2, 'paraphrase_recognition', `What problem does the ${man(B)} mention?`, comp.problem(v), comp.problemD(v), clamp(d, 3, 5) as Difficulty,
          `"${comp.bLine(v)}" → ${comp.problem(v)}`,
          '정답은 대화의 표현을 그대로 쓰지 않고 바꿔 말합니다(패러프레이즈). 대화의 단어가 그대로 들어간 보기는 오히려 함정일 가능성이 높습니다.',
          [lineIndex(comp.bLine(v).slice(0, 20))]);
      }
      case 'speaker_relationship': {
        if (used.has('role')) return false;
        used.add('role');
        const others = GOALS.flatMap((g) => g.instances).filter((i) => i.sit !== inst.sit && i.roleB !== inst.roleB).map((i) => ({ text: i.roleB, type: 'reasonable_but_unstated' as const }));
        return mk(0, 'speaker_relationship', `Who most likely is the ${man(B)}?`, inst.roleB, rng.shuffle(distinctFrom(inst.roleB, others)).slice(0, 6), 3,
          `${inst.roleB} — 대화 속 업무 단서.`,
          '직업/관계 문제는 한 단어가 아니라 여러 단서(하는 일, 쓰는 표현)를 종합합니다.', [1, 3]);
      }
      case 'location_context': {
        if (used.has('role')) return false;
        used.add('role');
        const others = GOALS.flatMap((g) => g.instances).filter((i) => i.place !== inst.place).map((i) => ({ text: i.place, type: 'reasonable_but_unstated' as const }));
        const stem = goal.isCall ? `Where does the ${man(B)} most likely work?` : 'Where most likely are the speakers?';
        return mk(0, 'location_context', stem, inst.place, rng.shuffle(distinctFrom(inst.place, others)).slice(0, 6), 3, `${inst.place} — 대화 속 장소 단서.`, '장소 문제는 대화 초반의 어휘(예약, 주문, 기계 등)를 종합해 판단합니다.', [0, 1]);
      }
      default:
        return false;
    }
  };

  const fallbacks: SkillId[] = ['extended_detail', 'next_action_prediction', 'paraphrase_recognition', 'speaker_relationship', 'extended_gist'];
  for (const s of requested) {
    if (!addSkill(s)) {
      // intent & implied share a single quoted line: substitute the second one
      const alt = INTENT_SKILLS.includes(s) ? 'next_action_prediction' : s === 'purpose_identification' ? 'extended_gist' : 'extended_detail';
      if (!addSkill(alt)) fallbacks.some((f) => addSkill(f));
    }
  }
  while (items.length < 3 && fallbacks.some((f) => addSkill(f))) {
    /* fill */
  }

  // ---- training-only flow item: integrate the whole conversation ----
  if (ctx.mode === 'training') {
    const flow = (a: string, b: string, c: string) => `${a} → ${b} → ${c}`;
    const siblingComp = goal.comps.find((c) => c.id !== comp.id);
    const siblingNext = goal.comps.flatMap((c) => c.intents.flatMap((i) => i.next)).find((n) => n.id !== next.id);
    const correctFlow = flow(goal.purpose(v), comp.problem(v), next.answer(v));
    const opts: OptLike[] = [];
    if (siblingComp) opts.push({ text: flow(goal.purpose(v), siblingComp.problem(v), next.answer(v)), type: 'reasonable_but_unstated' });
    if (siblingNext) opts.push({ text: flow(goal.purpose(v), comp.problem(v), siblingNext.answer(v)), type: 'reasonable_but_unstated' });
    const wrongPurpose = goal.purposeD(v)[0];
    opts.push({ text: flow(wrongPurpose.text, comp.problem(v), next.answer(v)), type: 'true_but_irrelevant' });
    opts.push({ text: flow(comp.problem(v).replace(/\.$/, ''), goal.purpose(v), next.answer(v)), type: 'opposite_meaning' });
    const uniq = opts.filter((o) => o.text !== correctFlow);
    if (uniq.length >= 3) {
      const item = makeItem(ctx, {
        stem: '[사고 훈련] Which best summarizes how the conversation develops?',
        raw: toRaw(correctFlow, rng.shuffle(uniq).slice(0, 3), (o) => `${TYPE_KO[o.type]} — 흐름의 한 단계가 대화와 다름`),
        skill: 'extended_gist',
        subskill: 'p3_flow',
        difficulty: gistD,
        short: '목적 → 문제 → 해결 흐름을 한 문장으로 통합하는 훈련입니다.',
        detail: '세부 정보는 잘 들리는데 요지를 놓친다면, 들으면서 "왜 시작했나 → 무엇이 막혔나 → 어떻게 끝났나" 세 칸을 채우는 습관이 효과적입니다.',
        evidenceLines: [0, 3, script.length - 1],
        trainingOnly: true,
      });
      items.push({ order: 5, item });
    }
  }

  items.sort((a, b) => a.order - b.order);
  const finalItems = items.map((x) => x.item);
  if (finalItems.filter((i) => !i.trainingOnly).length < 3) return null;

  const primary = slot.skill;
  const secs = scriptSeconds(script) + finalItems.length * (ctx.mode === 'training' ? 28 : 18) + (ctx.mode === 'training' ? 20 : 0);
  return finalizeQuestion(
    {
      part: 'P3',
      skill: primary,
      subskill: `p3_${goal.id}`,
      difficulty: Math.max(...finalItems.map((i) => i.difficulty)) as Difficulty,
      title: 'Conversation',
      audioScript: script,
      items: finalItems,
      vocabularyTargets: [],
      situation: inst.sit,
      topic: `${goal.id}:${inst.gen}`,
      questionStructure: `p3.tier${tier}.${finalItems.map((i) => i.skill).join('+')}`,
      reasoningPath: path.id,
      templateId: `p3i:${goal.id}:${inst.mine}`,
      estimatedSeconds: secs,
      generatorDifficulty: d,
    },
    ctx.now,
  );
}
