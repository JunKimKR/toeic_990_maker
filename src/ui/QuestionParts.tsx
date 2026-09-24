import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { DISTRACTOR_LABEL, explainDistractor } from '../domain/errorAnalysis';
import type { Graphic, Question, QuestionItem, ScriptLine } from '../domain/types';
import { Chip, Row, T } from './components';
import { radius, space, usePalette } from './theme';

const LETTERS = ['A', 'B', 'C', 'D'];

export function Passage({ text, title }: { text: string; title?: string }) {
  const p = usePalette();
  return (
    <View style={{ backgroundColor: p.surface, borderRadius: radius.l, borderWidth: 0.5, borderColor: p.border, padding: space.l }}>
      {title ? (
        <T v="label" c="text3" style={{ marginBottom: 6 }}>
          {title}
        </T>
      ) : null}
      <T selectable style={{ lineHeight: 25 }}>
        {text}
      </T>
    </View>
  );
}

export function GraphicTable({ g }: { g: Graphic }) {
  const p = usePalette();
  return (
    <View style={{ borderWidth: 0.5, borderColor: p.border, borderRadius: radius.m, overflow: 'hidden' }}>
      <T v="label" c="text3" style={{ padding: space.s }}>
        {g.title}
      </T>
      {[g.columns, ...g.rows].map((r, i) => (
        <Row key={i} style={{ borderTopWidth: 0.5, borderTopColor: p.border, backgroundColor: i === 0 ? p.surface2 : p.surface }}>
          {r.map((c, j) => (
            <T key={j} v="small" style={{ flex: 1, padding: space.s, fontWeight: i === 0 ? '700' : '400' }}>
              {c}
            </T>
          ))}
        </Row>
      ))}
    </View>
  );
}

export function ChoiceList({
  item,
  selected,
  submitted,
  hideText,
  onSelect,
}: {
  item: QuestionItem;
  selected: number | null;
  submitted: boolean;
  hideText?: boolean;
  onSelect(i: number): void;
}) {
  const p = usePalette();
  return (
    <View style={{ gap: space.s }}>
      {item.choices.map((c, i) => {
        const isKey = i === item.answerIndex;
        const isSel = i === selected;
        const bg = submitted ? (isKey ? p.goodBg : isSel ? p.badBg : p.surface) : isSel ? p.surface2 : p.surface;
        const border = submitted ? (isKey ? p.good : isSel ? p.bad : p.border) : isSel ? p.text : p.border;
        return (
          <Pressable
            key={i}
            testID={`choice-${i}`}
            disabled={submitted}
            onPress={() => onSelect(i)}
            style={({ pressed }) => ({ flexDirection: 'row', gap: space.m, alignItems: 'flex-start', backgroundColor: bg, borderWidth: isSel || (submitted && isKey) ? 1.5 : 0.5, borderColor: border, borderRadius: radius.m, padding: space.m, opacity: pressed ? 0.8 : 1 })}
          >
            <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: isSel && !submitted ? p.text : p.surface2 }}>
              <T v="small" c={isSel && !submitted ? 'bg' : 'text'} style={{ fontWeight: '700' }}>
                {LETTERS[i]}
              </T>
            </View>
            <View style={{ flex: 1, paddingTop: 2 }}>
              {hideText && !submitted ? (
                <T c="text3">({LETTERS[i]})</T>
              ) : (
                <T>{c.text}</T>
              )}
              {submitted && !isKey && isSel && c.distractorType ? (
                <T v="small" c="bad" style={{ marginTop: 4 }}>
                  함정: {DISTRACTOR_LABEL[c.distractorType]}
                </T>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** 3-step explanation: 1-2 lines -> Why? -> trap analysis. */
export function Feedback({ item, selected, correct, diagnosis, notes, delta }: { item: QuestionItem; selected: number; correct: boolean; diagnosis: string; notes: string[]; delta?: number }) {
  const p = usePalette();
  const [why, setWhy] = useState(false);
  const [trap, setTrap] = useState(!correct);
  const chosen = selected >= 0 ? item.choices[selected] : null;
  return (
    <View style={{ marginTop: space.l, gap: space.s }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <T v="h" c={correct ? 'good' : 'bad'}>
          {correct ? '정답' : selected < 0 ? '시간 초과' : '오답'}
        </T>
        {delta !== undefined && Math.abs(delta) >= 0.05 ? (
          <T v="small" c={delta > 0 ? 'good' : 'bad'}>
            {delta > 0 ? '+' : ''}
            {delta.toFixed(1)}
          </T>
        ) : null}
      </Row>
      <T c="text2">{item.explanation.short}</T>
      {diagnosis ? (
        <View style={{ backgroundColor: p.surface2, borderRadius: radius.m, padding: space.m }}>
          <T v="small" c="text">
            {diagnosis}
          </T>
        </View>
      ) : null}
      {notes.length ? (
        <Row style={{ flexWrap: 'wrap' }}>
          {notes.map((n) => (
            <Chip key={n} label={n} tone="warn" />
          ))}
        </Row>
      ) : null}
      <Row>
        <Chip label={why ? 'Why? 접기' : 'Why?'} active={why} onPress={() => setWhy(!why)} />
        <Chip label={trap ? '오답 분석 접기' : '오답 분석'} active={trap} onPress={() => setTrap(!trap)} />
      </Row>
      {why ? <T v="small" c="text2">{item.explanation.detail}</T> : null}
      {trap ? (
        <View style={{ gap: 6 }}>
          {item.choices.map((c, i) =>
            i === item.answerIndex ? null : (
              <View key={i} style={{ borderLeftWidth: 2, borderLeftColor: i === selected ? p.bad : p.border, paddingLeft: space.s }}>
                <T v="small" c={i === selected ? 'bad' : 'text2'}>
                  ({LETTERS[i]}) {c.text}
                </T>
                <T v="small" c="text3">
                  {c.distractorType ? `${DISTRACTOR_LABEL[c.distractorType]} — ${c.rationale ?? explainDistractor(c.distractorType)}` : c.rationale}
                </T>
              </View>
            ),
          )}
          {chosen?.distractorType ? (
            <T v="small" c="text2">
              {explainDistractor(chosen.distractorType)}
            </T>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function ScriptView({ lines, evidence }: { lines: ScriptLine[]; evidence?: number[] }) {
  const p = usePalette();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginTop: space.m }}>
      <Chip label={open ? '스크립트 숨기기' : '스크립트 보기 (근거 강조)'} onPress={() => setOpen(!open)} active={open} />
      {open ? (
        <View style={{ marginTop: space.s, gap: 6 }}>
          {lines.map((l, i) => {
            const ev = evidence?.includes(i);
            return (
              <View key={i} style={{ flexDirection: 'row', gap: space.s, backgroundColor: ev ? p.surface2 : 'transparent', borderLeftWidth: ev ? 2 : 0, borderLeftColor: p.accent, padding: 6, borderRadius: 4 }}>
                <T v="small" c="text3" style={{ width: 22, fontWeight: '700' }}>
                  {l.speaker === 'N' ? '' : l.speaker}
                </T>
                <T v="small" c={ev ? 'text' : 'text2'} style={{ flex: 1 }}>
                  {l.text}
                </T>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

export function partLabel(q: Question): string {
  switch (q.part) {
    case 'P2':
      return 'Part 2 · Question-Response';
    case 'P3':
      return 'Part 3 · Conversation';
    case 'P4':
      return `Part 4 · ${q.title ?? 'Talk'}`;
    case 'P5':
      return 'Part 5 · Incomplete Sentence';
    case 'P6':
      return 'Part 6 · Text Completion';
    case 'P7':
      return `Part 7 · ${q.title ?? 'Reading'}`;
    case 'VOC':
      return q.audioScript ? 'Vocabulary · Listening' : 'Vocabulary';
  }
}
