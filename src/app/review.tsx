/**
 * 오답 다시보기 — the ONLY place where previously shown questions reappear.
 * Answers here update skills as review evidence (weighted like normal answers)
 * but never count as first exposures.
 */
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SKILLS } from '../domain/skills';
import { AnswerFeedback, reviewQueue } from '../services/engine';
import { useApp, useData } from '../store/appStore';
import { AudioPlayer } from '../ui/AudioPlayer';
import { Button, Chip, Empty, Row, T } from '../ui/components';
import { IconClose } from '../ui/icons';
import { ChoiceList, Feedback, partLabel, Passage, ScriptView } from '../ui/QuestionParts';
import { space, usePalette } from '../ui/theme';

export default function Review() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const data = useData();
  const queue = useMemo(() => (data ? reviewQueue(data, 30) : []), [data]);
  const [idx, setIdx] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const [fb, setFb] = useState<AnswerFeedback | null>(null);
  const [plays, setPlays] = useState(0);
  const [t0, setT0] = useState(Date.now());
  const cur = queue[idx];

  if (!data) return null;
  const header = (
    <Row style={{ justifyContent: 'space-between', paddingTop: insets.top + space.s, paddingHorizontal: space.l }}>
      <Pressable onPress={() => router.back()} hitSlop={12}>
        <IconClose color={p.text2} size={22} />
      </Pressable>
      <T v="small" c="text3">
        오답 다시보기 {queue.length ? `${idx + 1}/${queue.length}` : ''}
      </T>
      <View style={{ width: 22 }} />
    </Row>
  );
  if (!cur)
    return (
      <View style={{ flex: 1, backgroundColor: p.bg }}>
        {header}
        <Empty title={queue.length ? '복습 완료' : '복습할 오답이 없습니다'} sub="틀린 문제와 '확신 없음'으로 맞힌 문제가 여기에 모입니다." />
        <Button title="닫기" onPress={() => router.back()} style={{ margin: space.l }} />
      </View>
    );
  const { question: q, item } = cur;
  const next = () => {
    setIdx(idx + 1);
    setSel(null);
    setFb(null);
    setPlays(0);
    setT0(Date.now());
  };
  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      {header}
      <ScrollView contentContainerStyle={{ padding: space.l, paddingBottom: 140 }}>
        <Row style={{ flexWrap: 'wrap' }}>
          <Chip label={partLabel(q)} />
          <Chip label={SKILLS[item.skill].label} />
          <Chip label={cur.attempt.correct ? '확신 없던 정답' : '지난 오답'} tone={cur.attempt.correct ? 'warn' : 'bad'} />
        </Row>
        {q.audioScript ? (
          <View style={{ marginTop: space.m }}>
            <AudioPlayer lines={q.audioScript} playKey={item.id} provider={data.profile.settings.ttsProvider} apiBaseUrl={data.profile.settings.apiBaseUrl} rate={data.profile.settings.speechRate} autoPlay={false} allowReplay allowSpeed onPlay={setPlays} onEnded={() => undefined} />
          </View>
        ) : null}
        {q.passage ? (
          <View style={{ marginTop: space.m }}>
            <Passage text={q.passage} />
          </View>
        ) : null}
        <T v="h" style={{ marginVertical: space.m }}>
          {item.stem}
        </T>
        <ChoiceList item={item} selected={sel} submitted={!!fb} hideText={q.part === 'P2' && !fb} onSelect={(i) => !fb && setSel(i)} />
        {fb ? (
          <>
            <Feedback item={item} selected={fb.attempt.selectedIndex} correct={fb.correct} diagnosis={fb.diagnosis} notes={fb.notes} />
            {q.audioScript ? <ScriptView lines={q.audioScript} evidence={item.evidenceLines} /> : null}
          </>
        ) : null}
      </ScrollView>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.l, paddingBottom: insets.bottom + space.m, backgroundColor: p.bg, borderTopWidth: 0.5, borderTopColor: p.border }}>
        {fb ? (
          <Button title="다음" onPress={next} />
        ) : (
          <Button
            title="제출"
            disabled={sel === null}
            onPress={() => {
              const r = useApp.getState().review({ question: q, item, selectedIndex: sel!, responseMs: Date.now() - t0, plays: Math.max(1, plays), confidence: null, answerChanges: 0, firstChoiceWasCorrect: sel === item.answerIndex });
              setFb(r);
            }}
          />
        )}
      </View>
    </View>
  );
}
