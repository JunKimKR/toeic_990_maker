/** Part 6 (connector + sentence insertion) and Part 7 (single passage set) generator. */
import type { Difficulty, Question, QuestionItem, SkillId } from '../../domain/types';
import { finalizeQuestion, makeItem } from '../build';
import { READING_KITS, ReadingKit, ROpt, RV } from '../content/readingKits';
import { freshWeight, GenContext } from '../genTypes';
import { CITIES, COMPANIES, DAYS, MONTHS, NUMBERS_WORD, person } from '../lexicon';
import { TYPE_KO } from './lcCommon';

function vars(ctx: GenContext, kit: ReadingKit): RV {
  const days = ctx.rng.shuffle(DAYS);
  const P = person(ctx.rng, ctx.rng.chance(0.5) ? 'M' : 'W');
  return {
    P,
    R: person(ctx.rng, ctx.rng.chance(0.5) ? 'M' : 'W', [P.first, P.last]),
    company: ctx.rng.pick(COMPANIES),
    city: ctx.rng.pick(CITIES),
    day: days[0],
    day2: days[1],
    month: ctx.rng.pick(MONTHS),
    n: ctx.rng.pick(NUMBERS_WORD.slice(4)),
    alt: ctx.rng.weighted(kit.alts, (a) => freshWeight(ctx.novelty.lexicalKeys.get(`rk:${kit.id}:${JSON.stringify(a)}`))),
  };
}

const raw = (answer: string, d: ROpt[]) => [{ text: answer, correct: true }, ...d.map((x) => ({ text: x.text, type: x.type, rationale: `${x.text}: ${TYPE_KO[x.type]}` }))];

function pickKit(ctx: GenContext, part: 'P6' | 'P7'): ReadingKit {
  return ctx.rng.weighted(READING_KITS, (k) => freshWeight(ctx.novelty.reasoningCounts.get(`${part.toLowerCase()}.${k.id}`)) * freshWeight(ctx.novelty.templateCounts.get(`rk:${k.id}`)));
}

export function generateP7(ctx: GenContext): Question | null {
  const kit = pickKit(ctx, 'P7');
  const v = vars(ctx, kit);
  const sentences = kit.sentences(v);
  const passage = `${kit.heading(v)}\n\n${sentences.join(' ')}`;
  const d = Math.max(3, ctx.slot.difficulty) as Difficulty;
  const items: QuestionItem[] = [];
  const used = new Set<string>();
  const add = (skill: SkillId): boolean => {
    const key = skill === 'purpose' ? 'purpose' : skill === 'specific_information' || skill === 'reference' ? 'detail' : skill === 'inference' || skill === 'multi_passage_synthesis' ? 'inference' : skill === 'vocabulary' || skill === 'paraphrase' ? 'vocab' : '';
    if (!key || used.has(key)) return false;
    used.add(key);
    if (key === 'purpose') {
      const p = kit.purpose(v);
      items.push(makeItem(ctx, { stem: p.stem, raw: raw(p.answer, p.d), skill: 'purpose', subskill: 'p7_purpose', difficulty: d, short: `목적: ${p.answer}.`, detail: '목적 문제는 첫 1-2문장과 글 전체의 요청 사항을 함께 봅니다. 본문의 단어가 그대로 들어간 보기는 함정인 경우가 많습니다.' }));
    } else if (key === 'detail') {
      const p = kit.detail(v);
      items.push(makeItem(ctx, { stem: p.stem, raw: raw(p.answer, p.d), skill: 'specific_information', subskill: 'p7_detail', difficulty: d, short: `근거 문장에서 확인: ${p.answer}.`, detail: '세부 정보 문제는 질문의 키워드로 근거 문장을 찾은 뒤, 패러프레이즈된 보기를 고릅니다.' }));
    } else if (key === 'inference') {
      const p = kit.inference(v);
      items.push(makeItem(ctx, { stem: p.stem, raw: raw(p.answer, p.d), skill: 'inference', subskill: 'p7_inference', difficulty: Math.min(5, d + 1) as Difficulty, short: p.why, detail: '추론 문제도 근거 문장이 있습니다. 본문과 반대되거나 언급되지 않은 보기를 먼저 소거하세요.' }));
    } else {
      const w = kit.vocab;
      items.push(makeItem(ctx, {
        stem: `In the ${kit.genre.toLowerCase()}, the word "${w.word}" is closest in meaning to`,
        raw: [{ text: w.answer, correct: true }, ...w.d.map((x) => ({ text: x, type: 'meaning_mismatch' as const, rationale: `${x}: 이 문맥에서의 의미가 아님 (다의어의 다른 뜻)` }))],
        skill: ctx.slot.skill === 'paraphrase' ? 'paraphrase' : 'vocabulary',
        subskill: 'p7_vocab_in_context',
        difficulty: d,
        short: w.why,
        detail: '동의어 문제는 사전의 첫 번째 뜻이 아니라 이 문장에서의 뜻을 묻습니다. 다의어의 다른 뜻이 함정으로 나옵니다.',
      }));
    }
    return true;
  };
  const requested = ctx.slot.itemSkills ?? [ctx.slot.skill, 'specific_information', 'inference'];
  for (const s of requested) if (!add(s)) (['specific_information', 'inference', 'purpose', 'vocabulary'] as SkillId[]).some((f) => add(f));
  while (items.length < 3 && (['purpose', 'specific_information', 'inference', 'vocabulary'] as SkillId[]).some((f) => add(f))) {
    /* fill */
  }
  return finalizeQuestion(
    {
      part: 'P7',
      skill: ctx.slot.skill,
      subskill: `p7_${kit.genre.toLowerCase()}`,
      difficulty: Math.max(...items.map((i) => i.difficulty)) as Difficulty,
      title: kit.genre,
      passage,
      items,
      vocabularyTargets: [kit.vocab.word],
      situation: kit.situation,
      topic: `p7:${kit.id}`,
      questionStructure: `p7.${items.map((i) => i.skill).join('+')}`,
      reasoningPath: `p7.${kit.id}`,
      templateId: `rk:${kit.id}`,
      estimatedSeconds: (ctx.mode === 'training' ? 60 : 50) + items.length * (ctx.mode === 'training' ? 32 : 25),
      generatorDifficulty: d,
      lexKeys: [`rk:${kit.id}:${JSON.stringify(v.alt)}`],
    },
    ctx.now,
  );
}

export function generateP6(ctx: GenContext): Question | null {
  const kit = pickKit(ctx, 'P6');
  const v = vars(ctx, kit);
  const s = kit.sentences(v);
  const d = Math.max(3, ctx.slot.difficulty) as Difficulty;
  const items: QuestionItem[] = [];

  // connector blank
  const withBlank = s.slice();
  const c = kit.connector;
  withBlank[c.index] = withBlank[c.index].replace(new RegExp(`^${c.word}`), '_______');

  // insertion: remove sentence k, mark positions
  const k = kit.insertIndex;
  const target = withBlank[k];
  const reduced = withBlank.filter((_, i) => i !== k);
  const positions = [-1, k - 1, k + 1, k + 2].filter((j) => j < reduced.length);
  const markers = ['[1]', '[2]', '[3]', '[4]'];
  const parts: string[] = [];
  if (positions.includes(-1)) parts.push(markers[0]);
  reduced.forEach((sent, j) => {
    parts.push(sent);
    const pi = positions.indexOf(j);
    if (pi >= 0) parts.push(markers[pi]);
  });
  const correctMarker = markers[positions.indexOf(k - 1)];
  const passage = `${kit.heading(v)}\n\n${parts.join(' ')}`;

  items.push(makeItem(ctx, {
    stem: `Choose the best word or phrase for the blank (_______).`,
    raw: [{ text: c.word, correct: true }, ...c.wrong.map((w) => ({ text: w, type: 'meaning_mismatch' as const, rationale: `${w}: 앞뒤 문장의 논리 관계와 맞지 않음` }))],
    skill: 'cross_sentence_connection',
    subskill: 'p6_connector',
    difficulty: d,
    short: c.why,
    detail: '접속부사 문제는 빈칸 앞 문장과 뒤 문장의 관계(대조/결과/추가/예시)를 먼저 한 단어로 정의한 뒤 고르면 흔들리지 않습니다.',
  }));
  const wrongMarkers = markers.filter((m, i) => i < positions.length && m !== correctMarker);
  if (wrongMarkers.length >= 3) {
    items.push(makeItem(ctx, {
      stem: `In which of the positions marked [1], [2], [3], and [4] does the following sentence best belong?\n"${target}"`,
      raw: [{ text: correctMarker, correct: true }, ...wrongMarkers.slice(0, 3).map((m) => ({ text: m, type: 'reasonable_but_unstated' as const, rationale: `${m}: 지시어/연결어가 가리킬 대상이 앞에 없음` }))],
      skill: ctx.slot.skill === 'text_structure' ? 'text_structure' : 'cross_sentence_connection',
      subskill: 'p6_insertion',
      difficulty: Math.min(5, d + 1) as Difficulty,
      short: `삽입 문장의 지시어/연결어("${target.split(' ').slice(0, 3).join(' ')}…")가 가리키는 대상이 바로 앞 문장에 있어야 합니다.`,
      detail: '문장 삽입은 삽입 문장의 대명사(it, this, they)·연결어(also, as a result)가 무엇을 받는지 찾고, 그 대상이 등장한 직후 위치를 고릅니다.',
    }));
  }
  return finalizeQuestion(
    {
      part: 'P6',
      skill: ctx.slot.skill,
      subskill: 'p6_text_completion',
      difficulty: Math.max(...items.map((i) => i.difficulty)) as Difficulty,
      title: kit.genre,
      passage,
      items,
      vocabularyTargets: [],
      situation: kit.situation,
      topic: `p6:${kit.id}`,
      questionStructure: 'p6.connector+insertion',
      reasoningPath: `p6.${kit.id}`,
      templateId: `rk:${kit.id}`,
      estimatedSeconds: (ctx.mode === 'training' ? 50 : 40) + items.length * (ctx.mode === 'training' ? 30 : 22),
      generatorDifficulty: d,
      lexKeys: [`rk:${kit.id}:${JSON.stringify(v.alt)}`],
    },
    ctx.now,
  );
}
