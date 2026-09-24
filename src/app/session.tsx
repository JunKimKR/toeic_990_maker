import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SKILLS } from '../domain/skills';
import type { ConfidenceLevel, Question } from '../domain/types';
import { AnswerFeedback, isListeningPart, itemsForMode } from '../services/engine';
import { useApp } from '../store/appStore';
import { AudioPlayer } from '../ui/AudioPlayer';
import { Button, Chip, ProgressBar, Row, T } from '../ui/components';
import { IconClose } from '../ui/icons';
import { ChoiceList, Feedback, GraphicTable, partLabel, Passage, ScriptView } from '../ui/QuestionParts';
import { space, usePalette } from '../ui/theme';

const CONF: { label: string; v: ConfidenceLevel }[] = [
  { label: '확신 없음', v: 0 },
  { label: '애매함', v: 1 },
  { label: '확신', v: 2 },
];

function fmt(sec: number) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function SessionScreen() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const runtime = useApp((s) => s.runtime);
  const data = useApp((s) => s.data);
  useApp((s) => s.version);
  const store = useApp.getState();
  const settings = data?.profile.settings;
  const mode = runtime?.session.mode ?? 'training';
  const exam = mode === 'exam';

  const [cur, setCur] = useState<{ question: Question; slotIndex: number } | null>(() => store.current());
  const [itemIdx, setItemIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [changes, setChanges] = useState(0);
  const [firstChoice, setFirstChoice] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [plays, setPlays] = useState(0);
  const [audioDone, setAudioDone] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const shownAt = useRef(Date.now());
  const audioEndAt = useRef<number | null>(null);
  const scroll = useRef<ScrollView>(null);

  const q = cur?.question ?? null;
  const items = useMemo(() => (q ? itemsForMode(q, mode) : []), [q, mode]);
  const item = items[itemIdx];
  const listening = !!q?.audioScript?.length;
  const lcPart = q ? isListeningPart(q.part) : false;
  const totalSlots = runtime?.session.blueprint.slots.length ?? 1;
  const budget = runtime?.session.blueprint.estimatedSeconds ?? 1800;

  // clock
  useEffect(() => {
    const t = setInterval(() => runtime && setElapsed((Date.now() - runtime.session.startedAt) / 1000), 1000);
    return () => clearInterval(t);
  }, [runtime]);

  const finishing = useRef(false);
  const finish = useCallback(() => {
    if (finishing.current) return;
    finishing.current = true;
    const s = useApp.getState().finish();
    if (s) router.replace({ pathname: '/result', params: { id: s.id } });
    else router.back();
  }, []);

  // exam mode: hard time limit
  useEffect(() => {
    if (exam && elapsed > budget) finish();
  }, [exam, elapsed, budget, finish]);

  // no session (e.g. app reloaded) -> go home
  useEffect(() => {
    if (!runtime && !finishing.current) router.replace('/');
  }, [runtime]);

  // new unit
  useEffect(() => {
    setItemIdx(0);
    setPlays(0);
    setAudioDone(!listening);
    audioEndAt.current = listening ? null : Date.now();
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [q?.id, listening]);

  // new item
  useEffect(() => {
    setSelected(null);
    setChanges(0);
    setFirstChoice(null);
    setFeedback(null);
    shownAt.current = Date.now();
  }, [q?.id, itemIdx]);

  if (!runtime || !settings) return null;
  if (!q || !item) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center', padding: space.xl }}>
        <T v="title">세션 완료</T>
        <Button title="결과 보기" onPress={finish} style={{ marginTop: space.l, alignSelf: 'stretch' }} />
      </View>
    );
  }

  const select = (i: number) => {
    if (feedback) return;
    if (firstChoice === null) setFirstChoice(i);
    if (selected !== null && selected !== i) setChanges((c) => c + 1);
    setSelected(i);
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => undefined);
  };

  const submit = (confidence: ConfidenceLevel | null) => {
    if (selected === null || feedback) return;
    const now = Date.now();
    // response time counts from when the item became answerable (end of audio for LC)
    const startAt = Math.max(shownAt.current, audioEndAt.current ?? now);
    const responseMs = Math.max(800, now - startAt);
    const fb = useApp.getState().answer({
      question: q,
      item,
      selectedIndex: selected,
      responseMs,
      plays: Math.max(1, plays),
      confidence,
      answerChanges: changes,
      firstChoiceWasCorrect: firstChoice === item.answerIndex,
    });
    if (!fb) return;
    if (Platform.OS !== 'web') Haptics.notificationAsync(fb.correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
    if (exam) goNext();
    else {
      setFeedback(fb);
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 80);
    }
  };

  const goNext = () => {
    if (itemIdx + 1 < items.length) {
      setItemIdx(itemIdx + 1);
      return;
    }
    const st = useApp.getState();
    st.next();
    const nxt = st.current();
    if (!nxt) {
      finish();
      return;
    }
    setCur(nxt);
  };

  const close = () => {
    const doIt = () => {
      if ((runtime?.attempts.length ?? 0) > 0) finish();
      else {
        useApp.getState().abandon();
        router.back();
      }
    };
    if (Platform.OS === 'web') return doIt();
    Alert.alert('세션을 종료할까요?', '지금까지 푼 문제는 저장되고 결과가 반영됩니다.', [
      { text: '계속하기', style: 'cancel' },
      { text: '종료', style: 'destructive', onPress: doIt },
    ]);
  };

  const progress = (cur!.slotIndex + (itemIdx + (feedback ? 1 : 0)) / Math.max(1, items.length)) / totalSlots;
  const hideChoiceText = q.part === 'P2' && !feedback;
  const canAnswer = !lcPart || audioDone || plays > 0;
  const skillMeta = SKILLS[item.skill];

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      {/* top bar */}
      <View style={{ paddingTop: insets.top + space.s, paddingHorizontal: space.l, paddingBottom: space.s }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Pressable testID="close-session" onPress={close} hitSlop={12}>
            <IconClose color={p.text2} size={22} />
          </Pressable>
          <T v="small" c="text3" style={{ fontVariant: ['tabular-nums'] }}>
            {exam ? `남은 시간 ${fmt(budget - elapsed)}` : `${fmt(elapsed)} / ${fmt(budget)}`}
          </T>
          <T v="small" c="text3">
            {cur!.slotIndex + 1}/{totalSlots}
          </T>
        </Row>
        <ProgressBar value={progress} style={{ marginTop: space.s }} />
      </View>

      <ScrollView ref={scroll} contentContainerStyle={{ padding: space.l, paddingBottom: 160 }}>
        <Row style={{ flexWrap: 'wrap' }}>
          <Chip label={partLabel(q)} />
          <Chip label={`${skillMeta.label} · D${item.difficulty}`} />
          {item.trainingOnly ? <Chip label="사고 훈련" tone="warn" /> : null}
          {runtime.session.blueprint.slots[cur!.slotIndex]?.isChallenge ? <Chip label="990 Challenge" tone="bad" /> : null}
          {exam ? <Chip label="EXAM" active /> : null}
        </Row>

        {listening ? (
          <View style={{ marginTop: space.m }}>
            <AudioPlayer
              lines={q.audioScript!}
              playKey={q.id}
              provider={settings.ttsProvider}
              apiBaseUrl={settings.apiBaseUrl}
              rate={settings.speechRate}
              autoPlay={exam || settings.autoPlay}
              allowReplay={!exam}
              allowSpeed={!exam}
              pauses={q.part === 'P2' ? { 0: 900, 1: 500, 2: 500 } : undefined}
              onPlay={(n) => setPlays(n)}
              onEnded={() => {
                setAudioDone(true);
                if (!audioEndAt.current) audioEndAt.current = Date.now();
              }}
            />
          </View>
        ) : null}

        {q.graphic ? (
          <View style={{ marginTop: space.m }}>
            <GraphicTable g={q.graphic} />
          </View>
        ) : null}
        {q.passage ? (
          <View style={{ marginTop: space.m }}>
            <Passage text={q.passage} title={q.part === 'P6' || q.part === 'P7' ? q.title : undefined} />
          </View>
        ) : null}

        {items.length > 1 ? (
          <T v="label" c="text3" style={{ marginTop: space.l }}>
            Question {itemIdx + 1} of {items.length}
          </T>
        ) : null}
        <T v="h" style={{ marginTop: items.length > 1 ? 4 : space.l, marginBottom: space.m, lineHeight: 24 }}>
          {item.stem}
        </T>

        <ChoiceList item={item} selected={selected} submitted={!!feedback} hideText={hideChoiceText} onSelect={select} />

        {feedback ? (
          <>
            <Feedback item={item} selected={feedback.attempt.selectedIndex} correct={feedback.correct} diagnosis={feedback.diagnosis} notes={feedback.notes} delta={feedback.masteryAfter - feedback.masteryBefore} />
            {q.audioScript && (q.part !== 'VOC' || true) ? <ScriptView lines={q.audioScript} evidence={item.evidenceLines} /> : null}
          </>
        ) : null}
      </ScrollView>

      {/* bottom action bar: thumb zone */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.l, paddingTop: space.s, paddingBottom: insets.bottom + space.m, backgroundColor: p.bg, borderTopWidth: 0.5, borderTopColor: p.border }}>
        {feedback ? (
          <Button testID="next" title={itemIdx + 1 < items.length ? '다음 문항' : '다음'} onPress={goNext} />
        ) : !canAnswer ? (
          <T v="small" c="text3" style={{ textAlign: 'center', paddingVertical: 14 }}>
            오디오를 재생하세요
          </T>
        ) : settings.askConfidence && !exam ? (
          <Row>
            {CONF.map((c) => (
              <Button key={c.v} testID={`submit-${c.v}`} title={c.label} kind={c.v === 2 ? 'primary' : 'secondary'} onPress={() => submit(c.v)} disabled={selected === null} style={{ flex: 1 }} small />
            ))}
          </Row>
        ) : (
          <Button testID="submit" title={exam ? '다음' : '제출'} onPress={() => submit(null)} disabled={selected === null} />
        )}
      </View>
    </View>
  );
}
