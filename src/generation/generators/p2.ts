/** Part 2 question-response generator. */
import type { Difficulty, Question, ScriptLine, SkillId } from '../../domain/types';
import { finalizeQuestion, makeItem } from '../build';
import { P2_FRAMES as P2_A, P2_TYPE_SKILL, P2Frame, P2Vars } from '../content/part2Frames';
import { P2_FRAMES_B } from '../content/part2FramesB';

const P2_FRAMES: P2Frame[] = [...P2_A, ...P2_FRAMES_B];
import { freshWeight, GenContext } from '../genTypes';
import { CITIES, COMPANIES, DAYS, DEPARTMENTS, person, TIMES } from '../lexicon';
import { pickAccents, TYPE_KO } from './lcCommon';

function frameFits(f: P2Frame, skill: SkillId): number {
  const s = P2_TYPE_SKILL[f.type];
  if (s === skill) return 3;
  if (skill === 'indirect_response') return 1.2; // any frame with an indirect correct answer
  if (skill === 'implied_meaning' && (f.type === 'statement' || f.type === 'suggestion')) return 2;
  if (skill === 'short_gist' && s !== 'negative_question') return 1;
  return 0.25;
}

function levelFor(d: Difficulty, skill: SkillId): 1 | 2 | 3 {
  if (skill === 'indirect_response' || skill === 'implied_meaning') return d >= 4 ? 3 : 2;
  if (d <= 2) return 1;
  if (d === 3) return 2;
  return d >= 5 ? 3 : 2;
}

export function generateP2(ctx: GenContext): Question | null {
  const { rng, slot, novelty } = ctx;
  const lvl = levelFor(slot.difficulty, slot.skill);
  const frame = rng.weighted(P2_FRAMES, (f) => frameFits(f, slot.skill) * freshWeight(novelty.reasoningCounts.get(`p2.${f.id}.${lvl}`)) * freshWeight(novelty.templateCounts.get(`p2:${f.id}`)));
  const alt = frame.alts ? rng.weighted(frame.alts, (a) => freshWeight(novelty.lexicalKeys.get(`p2alt:${frame.id}:${JSON.stringify(a)}`))) : {};
  const days = rng.shuffle(DAYS);
  const v: P2Vars = {
    p: person(rng, rng.chance(0.5) ? 'M' : 'W'),
    p2: person(rng, rng.chance(0.5) ? 'M' : 'W'),
    day: days[0],
    day2: days[1],
    time: rng.pick(TIMES),
    city: rng.pick(CITIES),
    dept: rng.pick(DEPARTMENTS),
    company: rng.pick(COMPANIES),
    x: alt,
  };
  const correct = frame.correct.find((c) => c.lvl === lvl) ?? frame.correct[0];
  // stronger traps at higher difficulty
  const strong = frame.wrong.filter((w) => w.type === 'similar_sound' || w.type === 'keyword_overlap');
  const weak = frame.wrong.filter((w) => !(w.type === 'similar_sound' || w.type === 'keyword_overlap'));
  const ordered = slot.difficulty >= 4 ? [...rng.shuffle(strong), ...rng.shuffle(weak)] : [...rng.shuffle(weak), ...rng.shuffle(strong)];
  const wrong = ordered.slice(0, 2);
  if (wrong.length < 2) return null;

  const q = frame.q(v);
  const ctext = correct.t(v);
  const item = makeItem(ctx, {
    stem: 'Listen to the question and choose the best response.',
    raw: [{ text: ctext, correct: true }, ...wrong.map((w) => ({ text: w.t(v), type: w.type, rationale: `${w.why} (${TYPE_KO[w.type]})` }))],
    skill: slot.skill === 'implied_meaning' || slot.skill === 'indirect_response' ? slot.skill : P2_TYPE_SKILL[frame.type],
    subskill: `p2_${frame.type}`,
    difficulty: (lvl === 1 ? 2 : lvl === 2 ? 3 : slot.difficulty >= 5 ? 5 : 4) as Difficulty,
    short: `"${ctext}" — ${correct.why}.`,
    detail:
      lvl === 3
        ? '990 구간의 Part 2 정답은 질문에 직접 답하지 않습니다. 되묻기, 상황 설명, 제3자 언급, 대안 제시로 "대화가 자연스럽게 이어지는가"를 기준으로 고르세요. 질문의 단어가 반복되거나 발음이 비슷한 보기는 대부분 함정입니다.'
        : '의문사/질문 유형을 먼저 잡고, 그 유형에 맞는 응답인지 확인하세요. 질문 단어 반복·유사 발음 보기를 먼저 소거하면 빠릅니다.',
  });
  const [accQ, accR] = pickAccents(rng);
  const qSpk = rng.chance(0.5) ? 'M' : 'W';
  const rSpk = qSpk === 'M' ? 'W' : 'M';
  const letters = ['A', 'B', 'C'];
  const audio: ScriptLine[] = [
    { speaker: qSpk, text: q, accent: accQ },
    ...item.choices.map((c, i) => ({ speaker: rSpk as 'M' | 'W', text: `${letters[i]}. ${c.text}`, accent: accR })),
  ];
  return finalizeQuestion(
    {
      part: 'P2',
      skill: item.skill,
      subskill: `p2_${frame.type}`,
      difficulty: item.difficulty,
      audioScript: audio,
      items: [item],
      vocabularyTargets: [],
      situation: frame.situation,
      topic: `p2:${frame.type}`,
      questionStructure: `p2.${frame.type}.lvl${lvl}`,
      reasoningPath: `p2.${frame.id}.${lvl}`,
      templateId: `p2:${frame.id}`,
      estimatedSeconds: ctx.mode === 'training' ? 36 : 22,
      generatorDifficulty: slot.difficulty,
      lexKeys: frame.alts ? [`p2alt:${frame.id}:${JSON.stringify(alt)}`] : [],
    },
    ctx.now,
  );
}
