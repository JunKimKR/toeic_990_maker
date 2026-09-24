/** Part 4 talk generator. */
import { clamp } from '../../domain/rng';
import type { Difficulty, Question, QuestionItem, ScriptLine, SkillId } from '../../domain/types';
import { finalizeQuestion, makeItem } from '../build';
import { TALKS as TALKS_A, TalkKit, TalkTurn, TInst, TOpt, TV } from '../content/part4Talks';
import { TALKS_B } from '../content/part4TalksB';

const TALKS: TalkKit[] = [...TALKS_A, ...TALKS_B];
import { freshWeight, GenContext, situationWeight } from '../genTypes';
import { CITIES, COMPANIES, DAYS, NUMBERS_WORD, person, TIMES } from '../lexicon';
import { distinctFrom, OptLike, pickDistractors, relabel, scriptSeconds, toRaw, TYPE_KO } from './lcCommon';

const he = (g: 'M' | 'W') => (g === 'M' ? 'he' : 'she');

export function generateP4(ctx: GenContext): Question | null {
  const { rng, slot, novelty } = ctx;
  const d = slot.difficulty;
  const wantIndirect = d >= 5 ? 3 : d >= 4 ? 2 : 1.5;
  const cands: { kit: TalkKit; inst: TInst; turn: TalkTurn; w: number; id: string }[] = [];
  for (const kit of TALKS) {
    for (const inst of kit.instances) {
      for (const turn of kit.turns) {
        if (turn.kinds && !turn.kinds.includes(inst.kind ?? 'default')) continue;
        const id = `p4.${kit.id}.${turn.id}`;
        const w =
          situationWeight(inst.sit, novelty) *
          freshWeight(novelty.reasoningCounts.get(id)) *
          freshWeight(novelty.templateCounts.get(`p4i:${kit.id}:${JSON.stringify(inst.f).slice(0, 40)}`)) *
          (1 / (1 + Math.abs(turn.indirect - wantIndirect)));
        cands.push({ kit, inst, turn, w, id });
      }
    }
  }
  if (!cands.length) return null;
  const { kit, inst, turn, id } = rng.weighted(cands, (c) => c.w);

  const S = person(rng, rng.chance(0.5) ? 'M' : 'W');
  const Lp = person(rng, rng.chance(0.5) ? 'M' : 'W', [S.first, S.last]);
  const third = person(rng, rng.chance(0.5) ? 'M' : 'W', [S.first, S.last, Lp.first, Lp.last]);
  const days = rng.shuffle(DAYS);
  const v: TV = {
    S,
    L: Lp,
    third,
    i: inst,
    day: days[0],
    day2: days[1],
    time: rng.pick(TIMES),
    city: rng.pick(CITIES),
    company: rng.pick(COMPANIES),
    n: rng.pick(NUMBERS_WORD.slice(2, 7)),
  };

  const gistPrimary = slot.skill === 'extended_gist' || slot.skill === 'purpose_identification';
  const tier: 1 | 2 | 3 = gistPrimary ? (d >= 5 ? 3 : d >= 4 ? rng.pick([2, 3]) : 2) : d >= 4 ? rng.pick([2, 3]) : rng.pick([1, 2]);
  const opening = rng.pick(kit.opening[tier])(v);
  const accent = rng.pick(['us', 'gb', 'au', 'ca'] as const);
  const sp = S.gender === 'M' ? 'M' : 'W';
  const lines: ScriptLine[] = [opening, kit.detail(v), turn.setup(v), turn.line(v), turn.follow(v), turn.request(v)].map((text) => ({ speaker: sp, text, accent }));
  const scriptText = lines.map((l) => l.text).join(' ');
  const intentLine = turn.line(v);
  const intentD = clamp(turn.indirect + 2, 2, 5) as Difficulty;
  const gistD = clamp(tier + 2 + (d >= 5 ? 1 : 0), 2, 5) as Difficulty;

  const items: { order: number; item: QuestionItem }[] = [];
  const used = new Set<string>();
  const mk = (order: number, skill: SkillId, stem: string, correct: string, opts: TOpt[], diff: Difficulty, short: string, detail: string, ev: number[], extra: Partial<QuestionItem> = {}) => {
    const ds = pickDistractors(rng, opts.map((o) => relabel(o as OptLike, scriptText)), 3, diff, correct);
    if (ds.length < 3) return false;
    items.push({
      order,
      item: makeItem(ctx, {
        stem,
        raw: toRaw(correct, ds, (o) => `${o.text}: ${TYPE_KO[o.type]}`),
        skill,
        subskill: `p4_${skill}`,
        difficulty: diff,
        short,
        detail,
        evidenceLines: ev,
        quotedLine: extra.quotedLine,
        trainingOnly: extra.trainingOnly,
      }),
    });
    return true;
  };

  const roleOthers = (field: 'role' | 'place') =>
    TALKS.filter((k) => k.type !== kit.type)
      .flatMap((k) => k.instances)
      .filter((i) => i[field] !== inst[field])
      .map((i) => ({ text: i[field], type: 'reasonable_but_unstated' as const }));

  const add = (skill: SkillId): boolean => {
    switch (skill) {
      case 'extended_gist':
      case 'purpose_identification':
        if (used.has('gist')) return false;
        used.add('gist');
        return mk(0, skill, kit.purposeStem, kit.purpose(v), kit.purposeD(v), gistD, `요지: ${kit.purpose(v)}.`,
          tier === 1 ? '첫 문장에서 목적/주제를 밝힙니다.' : '담화의 목적이 첫 문장에 직접 나오지 않습니다. 도입부의 배경 설명(날씨, 감사 인사, 이야기)은 목적이 아니라 맥락입니다. 담화 전체가 무엇을 알리려는지 통합하세요.', [0]);
      case 'speaker_intent':
        if (used.has('intent')) return false;
        used.add('intent');
        return mk(2, skill, `Why does the speaker say, "${intentLine}"?`, turn.why(v), turn.whyD(v), intentD, `기능: ${turn.why(v)}.`,
          `인용문 앞의 "${turn.setup(v)}"와 뒤의 "${turn.follow(v)}"가 이 말의 역할을 결정합니다. 표면 의미 그대로의 보기가 가장 흔한 함정입니다.`, [2, 3, 4], { quotedLine: intentLine });
      case 'implied_meaning':
        if (used.has('intent')) return false;
        used.add('intent');
        return mk(2, skill, `What does the speaker imply when ${he(S.gender)} says, "${intentLine}"?`, turn.implies(v), turn.impliesD(v), intentD, `함축: ${turn.implies(v)}`,
          `바로 뒤 문장 "${turn.follow(v)}"가 함축된 의미를 확인해 줍니다.`, [3, 4], { quotedLine: intentLine });
      case 'next_action_prediction':
        if (used.has('next')) return false;
        used.add('next');
        return mk(3, skill, turn.reqStem, turn.reqAnswer(v), turn.reqD(v), clamp(d, 3, 4) as Difficulty, `근거: "${turn.request(v)}"`, '요청/다음 행동 문제의 근거는 대부분 담화 마지막 부분에 있고, 정답은 그 표현을 바꿔 말합니다.', [5]);
      case 'extended_detail': {
        if (used.has('detail')) return false;
        used.add('detail');
        const dq = kit.detailQ(v);
        return mk(1, skill, dq.stem, dq.answer, dq.d, 3, `근거: "${kit.detail(v)}"`, '질문의 키워드를 먼저 읽고 해당 정보를 기다리세요.', [1]);
      }
      case 'paraphrase_recognition':
        if (used.has('problem')) return false;
        used.add('problem');
        return mk(1, skill, 'What problem does the speaker mention?', turn.problem(v), turn.problemD(v), clamp(d, 3, 5) as Difficulty, `"${turn.setup(v)}" → ${turn.problem(v)}`, '정답은 담화의 표현을 다른 말로 바꿔 씁니다.', [2]);
      case 'location_context':
      case 'speaker_relationship': {
        if (used.has('role')) return false;
        used.add('role');
        const isWho = kit.roleStem.startsWith('Who');
        const answer = isWho ? inst.role : inst.place;
        return mk(0, skill, kit.roleStem, answer, rng.shuffle(distinctFrom(answer, roleOthers(isWho ? 'role' : 'place'))).slice(0, 6), 3, `${answer} — 담화의 어휘 단서.`, '장소/화자 문제는 여러 단서를 종합합니다.', [0]);
      }
      default:
        return false;
    }
  };

  const requested = (slot.itemSkills ?? [slot.skill, 'extended_detail', 'next_action_prediction']).slice(0, 3);
  const fallbacks: SkillId[] = ['extended_detail', 'next_action_prediction', 'paraphrase_recognition', 'location_context', 'extended_gist'];
  for (const s of requested) if (!add(s)) fallbacks.some((f) => add(f));
  while (items.length < 3 && fallbacks.some((f) => add(f))) {
    /* fill */
  }

  if (ctx.mode === 'training') {
    const other = kit.turns.find((t) => t.id !== turn.id);
    const flow = (a: string, b: string, c: string) => `${a} → ${b} → ${c}`;
    const correct = flow(kit.purpose(v), turn.problem(v), turn.reqAnswer(v));
    const opts: OptLike[] = [
      { text: flow(kit.purposeD(v)[0].text, turn.problem(v), turn.reqAnswer(v)), type: 'true_but_irrelevant' },
      { text: flow(kit.purpose(v), turn.problemD(v)[0].text, turn.reqAnswer(v)), type: 'reasonable_but_unstated' },
    ];
    if (other) opts.push({ text: flow(kit.purpose(v), turn.problem(v), other.reqAnswer(v)), type: 'reasonable_but_unstated' });
    opts.push({ text: flow(kit.purpose(v), turn.problem(v), turn.reqD(v)[0].text), type: 'keyword_overlap' });
    const ds = rng.shuffle(opts.filter((o) => o.text !== correct)).slice(0, 3);
    if (ds.length === 3) {
      items.push({
        order: 5,
        item: makeItem(ctx, {
          stem: '[사고 훈련] Which best summarizes the talk from start to finish?',
          raw: toRaw(correct, ds, (o) => `${TYPE_KO[o.type]} — 흐름의 한 단계가 담화와 다름`),
          skill: 'extended_gist',
          subskill: 'p4_flow',
          difficulty: gistD,
          short: '목적 → 문제 → 요청 흐름으로 담화 전체를 통합합니다.',
          detail: '긴 담화는 "왜 말하나 → 무엇이 바뀌었나/문제인가 → 청자에게 무엇을 원하나" 3단계로 정리하며 들으면 요지·의도 문제가 함께 풀립니다.',
          evidenceLines: [0, 2, 5],
          trainingOnly: true,
        }),
      });
    }
  }

  items.sort((a, b) => a.order - b.order);
  const final = items.map((x) => x.item);
  if (final.filter((i) => !i.trainingOnly).length < 3) return null;
  return finalizeQuestion(
    {
      part: 'P4',
      skill: slot.skill,
      subskill: `p4_${kit.type}`,
      difficulty: Math.max(...final.map((i) => i.difficulty)) as Difficulty,
      title: kit.title,
      audioScript: lines,
      items: final,
      vocabularyTargets: [],
      situation: inst.sit,
      topic: `${kit.type}:${Object.values(inst.f)[0]}`,
      questionStructure: `p4.${kit.type}.tier${tier}.${final.map((i) => i.skill).join('+')}`,
      reasoningPath: id,
      templateId: `p4i:${kit.id}:${JSON.stringify(inst.f).slice(0, 40)}`,
      estimatedSeconds: scriptSeconds(lines) + final.length * (ctx.mode === 'training' ? 28 : 18) + (ctx.mode === 'training' ? 20 : 0),
      generatorDifficulty: d,
    },
    ctx.now,
  );
}
