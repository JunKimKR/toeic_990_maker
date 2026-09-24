import { uid } from '../domain/rng';
import type { Difficulty, DistractorType, Question, QuestionItem, SkillId } from '../domain/types';
import { computeSemanticFingerprint } from './fingerprint';
import { arrangeChoices, GenContext, RawChoice } from './genTypes';

export type QuestionDraft = Omit<Question, 'id' | 'semanticFingerprint' | 'generationTimestamp' | 'sourceType' | 'distractorTypes'> & {
  sourceType?: Question['sourceType'];
};

export function finalizeQuestion(d: QuestionDraft, now: number): Question {
  const distractorTypes = [
    ...new Set(d.items.flatMap((i) => i.choices.map((c) => c.distractorType).filter((x): x is DistractorType => !!x))),
  ];
  const q: Question = {
    ...d,
    id: uid('q'),
    sourceType: d.sourceType ?? 'procedural',
    generationTimestamp: now,
    distractorTypes,
    semanticFingerprint: '',
  };
  q.semanticFingerprint = computeSemanticFingerprint(q);
  return q;
}

export interface ItemSpec {
  stem: string;
  raw: RawChoice[];
  skill: SkillId;
  subskill: string;
  difficulty: Difficulty;
  short: string;
  detail: string;
  evidenceLines?: number[];
  quotedLine?: string;
  secondarySkills?: SkillId[];
  trainingOnly?: boolean;
}

export function makeItem(ctx: GenContext, s: ItemSpec): QuestionItem {
  const { choices, answerIndex } = arrangeChoices(ctx.rng, s.raw, ctx.novelty);
  return {
    id: uid('it'),
    stem: s.stem,
    choices,
    answerIndex,
    skill: s.skill,
    subskill: s.subskill,
    secondarySkills: s.secondarySkills,
    difficulty: s.difficulty,
    explanation: { short: s.short, detail: s.detail },
    evidenceLines: s.evidenceLines,
    quotedLine: s.quotedLine,
    trainingOnly: s.trainingOnly,
  };
}
