import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { SKILLS } from '../../domain/skills';
import { useData } from '../../store/appStore';
import { Bars } from '../../ui/charts';
import { Card, Chip, Empty, Row, Screen, SectionTitle, T, pct } from '../../ui/components';
import { space } from '../../ui/theme';

export default function History() {
  const data = useData();
  if (!data) return null;
  const sessions = data.sessions.filter((s) => s.summary).slice().reverse();
  const last14 = sessions.slice(0, 14).reverse();
  return (
    <Screen>
      <T v="label" c="text3">
        History
      </T>
      <T v="title" style={{ marginTop: 4 }}>
        학습 기록
      </T>
      {last14.length >= 2 ? (
        <>
          <SectionTitle>최근 세션 정답률</SectionTitle>
          <Card>
            <Bars data={last14.map((s) => ({ label: new Date(s.startedAt).getDate().toString(), value: Math.round((s.summary!.accuracy ?? 0) * 100) }))} />
          </Card>
        </>
      ) : null}
      <SectionTitle>세션</SectionTitle>
      {sessions.length === 0 ? <Empty title="아직 기록이 없습니다" sub="첫 세션을 마치면 여기에 표시됩니다." /> : null}
      {sessions.map((s) => {
        const r = s.summary!;
        return (
          <Card key={s.id} style={{ marginBottom: space.s }} onPress={() => router.push({ pathname: '/result', params: { id: s.id } })}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View>
                <T v="h">{new Date(s.startedAt).toLocaleDateString()} {new Date(s.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</T>
                <T v="small" c="text3">
                  {Math.round(r.durationSec / 60)}분 · {r.items}문항 · 첫 청취 {pct(r.firstListenAccuracy)}
                </T>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <T v="num" style={{ fontSize: 22 }}>
                  {pct(r.accuracy)}
                </T>
                {s.mode === 'exam' ? <Chip label="EXAM" /> : null}
              </View>
            </Row>
            {r.biggestGain ? (
              <T v="small" c="good" style={{ marginTop: 6 }}>
                {SKILLS[r.biggestGain.skill].label} {r.biggestGain.before.toFixed(0)} → {r.biggestGain.after.toFixed(0)}
              </T>
            ) : null}
          </Card>
        );
      })}
    </Screen>
  );
}
