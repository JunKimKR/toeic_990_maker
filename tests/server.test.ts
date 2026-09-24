/**
 * Backend pipeline with a scripted LLM (no network, no cost):
 * generator draft -> local critic -> blind-solve critic -> accept/reject.
 */
import { createHandler } from '../server/index';
import { ScriptedProvider } from '../server/llm';
import { acceptRemote } from '../src/services/aiClient';

const draftP5 = {
  situation: 'office',
  topic: 'deadline preposition',
  title: null,
  passage: null,
  audioScript: [],
  grammarPoint: 'within + period',
  vocabularyTargets: [],
  reasoningSummary: 'choose within for a time span limit',
  items: [
    {
      stem: 'Warranty claims must be filed _______ thirty days of purchase.',
      skill: 'grammar',
      subskill: 'preposition',
      difficulty: 3,
      correct: 'within',
      distractors: [
        { text: 'during', type: 'grammar_surface_match', why: 'during + 기간은 "기간 동안"이며 기한 내를 뜻하지 않음' },
        { text: 'among', type: 'meaning_mismatch', why: '셋 이상 사이' },
        { text: 'along', type: 'meaning_mismatch', why: '~을 따라' },
      ],
      explanationShort: '기간 이내 → within.',
      explanationDetail: 'within + 기간 = 그 기간 이내에.',
      quotedLine: null,
      evidenceLines: [],
    },
  ],
};

function handler(criticChoice: string) {
  const gen = new ScriptedProvider(() => draftP5);
  const critic = new ScriptedProvider(() => ({ items: [{ chosen: criticChoice, defensibleAlternatives: [], ambiguous: false }], naturalness: 9, toeicLikeness: 9, estimatedDifficulty: 3, problems: [] }));
  return createHandler({ llm: gen, critic, tts: null, appToken: '', ratePerMinute: 100 });
}

const req = (body: unknown) => new Request('http://x/v1/generate', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });

describe('backend generation', () => {
  it('health reports providers', async () => {
    const r = await handler('within')(new Request('http://x/v1/health'));
    expect((await r.json()).provider).toBe('scripted');
  });
  it('accepts when the independent critic solves it blind to the same key', async () => {
    const r = await handler('within')(req({ specs: [{ part: 'P5', skill: 'grammar', difficulty: 3 }], avoid: { reasoningPaths: [], topics: [] } }));
    const j = await r.json();
    expect(j.questions).toHaveLength(1);
    const q = j.questions[0];
    expect(q.sourceType).toBe('ai');
    expect(q.items[0].choices[q.items[0].answerIndex].text).toBe('within');
    // the app re-validates everything it receives
    expect(acceptRemote(q, Date.now())).not.toBeNull();
  });
  it('rejects when the blind solve disagrees (possible second answer)', async () => {
    const r = await handler('during')(req({ specs: [{ part: 'P5', skill: 'grammar', difficulty: 3 }], avoid: { reasoningPaths: [], topics: [] } }));
    const j = await r.json();
    expect(j.questions).toHaveLength(0);
    expect(j.reasons[0]).toContain('blind solve');
  });
  it('rejects a repeated reasoning path', async () => {
    const first = await (await handler('within')(req({ specs: [{ part: 'P5', skill: 'grammar', difficulty: 3 }], avoid: { reasoningPaths: [], topics: [] } }))).json();
    const path = first.questions[0].reasoningPath;
    const j = await (await handler('within')(req({ specs: [{ part: 'P5', skill: 'grammar', difficulty: 3 }], avoid: { reasoningPaths: [path], topics: [] } }))).json();
    expect(j.questions).toHaveLength(0);
  });
  it('guards with an app token when configured', async () => {
    const h = createHandler({ llm: new ScriptedProvider(() => draftP5), tts: null, appToken: 'secret' });
    expect((await h(req({ specs: [] }))).status).toBe(401);
  });
  it('no provider -> 503, app keeps using the offline engine', async () => {
    const h = createHandler({ llm: null, tts: null, appToken: '' });
    expect((await h(req({ specs: [] }))).status).toBe(503);
  });
});
