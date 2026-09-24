import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { causeLabel, DISTRACTOR_LABEL } from '../domain/errorAnalysis';
import { SKILLS } from '../domain/skills';
import { useData } from '../store/appStore';
import { Button, Card, Chip, Divider, Row, Screen, SectionTitle, Stat, T, pct } from '../ui/components';
import { space } from '../ui/theme';

export default function Result() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const data = useData();
  const s = data?.sessions.find((x) => x.id === id) ?? data?.sessions[data.sessions.length - 1];
  if (!data || !s?.summary) {
    return (
      <Screen>
        <T v="title">결과가 없습니다</T>
        <Button title="홈으로" onPress={() => router.replace('/')} style={{ marginTop: space.l }} />
      </Screen>
    );
  }
  const r = s.summary;
  const gains = r.skillDeltas.filter((d) => Math.abs(d.after - d.before) >= 0.5).sort((a, b) => Math.abs(b.after - b.before) - Math.abs(a.after - a.before)).slice(0, 6);
  return (
    <Screen bottom={<Button testID="done" title="홈으로" onPress={() => router.replace('/')} />}>
      <T v="label" c="text3">
        {s.mode === 'exam' ? 'EXAM RESULT' : 'TODAY'}
      </T>
      <T v="title" style={{ marginTop: 4 }}>
        {new Date(s.startedAt).toLocaleDateString()} · {Math.round(r.durationSec / 60)}분 · {r.items}문항
      </T>

      <Card style={{ marginTop: space.l }}>
        <Row>
          <Stat label="Accuracy" value={pct(r.accuracy)} sub={`${r.correct}/${r.items}`} />
          <Stat label="First Listen" value={pct(r.firstListenAccuracy)} />
        </Row>
        <Divider />
        <Row>
          <Stat label="Avg Response" value={`${r.avgResponseSec.toFixed(1)}s`} />
          <Stat label="Difficulty 5" value={pct(r.highDifficultyAccuracy)} />
        </Row>
      </Card>

      {r.biggestGain ? (
        <>
          <SectionTitle>Biggest Gain</SectionTitle>
          <Card>
            <T v="h">{SKILLS[r.biggestGain.skill].label}</T>
            <T v="num" style={{ marginTop: 4 }}>
              {r.biggestGain.before.toFixed(1)} → {r.biggestGain.after.toFixed(1)}
            </T>
          </Card>
        </>
      ) : null}

      <SectionTitle>Today&apos;s Pattern</SectionTitle>
      <Card>
        <T>{r.pattern}</T>
        {r.topTraps.length ? (
          <Row style={{ marginTop: space.m, flexWrap: 'wrap' }}>
            {r.topTraps.map((t) => (
              <Chip key={t.type} label={`${DISTRACTOR_LABEL[t.type]} ×${t.count}`} tone="bad" />
            ))}
          </Row>
        ) : null}
        {r.topCauses.length ? (
          <T v="small" c="text3" style={{ marginTop: space.s }}>
            추정 원인: {r.topCauses.map((c) => `${causeLabel(c.cause)} ${c.count}`).join(' · ')}
          </T>
        ) : null}
      </Card>

      {gains.length ? (
        <>
          <SectionTitle>Skill Change</SectionTitle>
          <Card>
            {gains.map((d) => (
              <Row key={d.skill} style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
                <T>{SKILLS[d.skill].label}</T>
                <T v="h" c={d.after >= d.before ? 'good' : 'bad'} style={{ fontVariant: ['tabular-nums'] }}>
                  {d.before.toFixed(1)} → {d.after.toFixed(1)}
                </T>
              </Row>
            ))}
          </Card>
        </>
      ) : null}

      <SectionTitle>Next Session</SectionTitle>
      <Card>
        <T v="h">{r.nextFocus.join(' + ')}</T>
        <T v="small" c="text3" style={{ marginTop: 4 }}>
          을(를) 강화합니다.
        </T>
      </Card>

      {r.achievements.length ? (
        <>
          <SectionTitle>Performance</SectionTitle>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {r.achievements.map((a) => (
              <Chip key={a} label={a} tone="good" />
            ))}
          </View>
        </>
      ) : null}
      <Button kind="secondary" title="오답 다시보기" onPress={() => router.push('/review')} style={{ marginTop: space.xl }} />
    </Screen>
  );
}
