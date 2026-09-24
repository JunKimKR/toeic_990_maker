import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { View } from 'react-native';
import { dayKey } from '../../domain/rng';
import { masteryFromTheta, toView } from '../../domain/skillModel';
import { GROUP_LABEL, SKILLS } from '../../domain/skills';
import type { DisplayGroup } from '../../domain/types';
import { reviewQueue } from '../../services/engine';
import { useApp, useData } from '../../store/appStore';
import { Trend, StackBar } from '../../ui/charts';
import { Button, Card, Chip, Row, Screen, SectionTitle, Spacer, T, pct } from '../../ui/components';
import { IconChevron } from '../../ui/icons';
import { Palette, space, usePalette } from '../../ui/theme';

const GROUP_ORDER: DisplayGroup[] = ['intent', 'gist', 'vocabulary', 'grammar', 'listening', 'reading', 'maintenance', 'challenge'];

export function groupColor(g: DisplayGroup, p: Palette): string {
  const m: Record<DisplayGroup, string> = {
    intent: p.accent,
    gist: p.dark ? '#7DA2FF' : '#0B2E8A',
    vocabulary: p.dark ? '#E7A6FF' : '#7B2FA0',
    grammar: p.dark ? '#FFB86B' : '#B35C00',
    listening: p.text2,
    reading: p.text3,
    maintenance: p.dark ? '#4A4E55' : '#B9BBBF',
    challenge: p.bad,
  };
  return m[g];
}

function greeting(h: number) {
  if (h < 5) return 'LATE NIGHT';
  if (h < 12) return 'GOOD MORNING';
  if (h < 18) return 'GOOD AFTERNOON';
  return 'GOOD EVENING';
}

export default function Home() {
  const data = useData();
  const plan = useApp((s) => s.plan);
  const runtime = useApp((s) => s.runtime);
  const start = useApp((s) => s.start);
  const ai = useApp((s) => s.ai);
  const p = usePalette();
  const now = new Date();

  const views = useMemo(() => (data ? Object.values(data.skills).map(toView) : []), [data, data?.attempts.length]);
  if (!data || !plan) return null;

  const trainedToday = data.sessions.some((s) => s.endedAt && dayKey(s.endedAt) === dayKey(Date.now()) && s.mode === 'training');
  const improving = views.filter((v) => v.trend > 0.4 && v.attemptCount > 0).sort((a, b) => b.trend - a.trend).slice(0, 3);
  const reviewCount = reviewQueue(data, 99).length;
  const lastFL = [...data.sessions].reverse().find((s) => s.summary?.firstListenAccuracy != null)?.summary?.firstListenAccuracy ?? null;
  const groups = GROUP_ORDER.filter((g) => (plan.groupCounts[g] ?? 0) > 0);

  const begin = (mode: 'training' | 'exam') => {
    if (runtime) return router.push('/session');
    if (start(mode)) router.push('/session');
  };

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <T v="label" c="text3">
          {greeting(now.getHours())}
        </T>
        <Row>
          {data.profile.streak.current > 0 ? <Chip label={`${data.profile.streak.current}일 연속`} /> : null}
          {lastFL != null ? <Chip label={`첫 청취 ${pct(lastFL)}`} /> : null}
        </Row>
      </Row>
      <T v="title" style={{ marginTop: space.s }}>
        990까지 가장 큰 병목
      </T>

      <Card style={{ marginTop: space.m, paddingVertical: space.s }} onPress={() => router.push('/weakness')}>
        {plan.bottlenecks.map((s, i) => {
          const v = views.find((x) => x.skill === s)!;
          return (
            <Row key={s} style={{ paddingVertical: space.m, borderTopWidth: i ? 0.5 : 0, borderTopColor: p.border }}>
              <T v="h" c="text3" style={{ width: 22 }}>
                {i + 1}
              </T>
              <View style={{ flex: 1 }}>
                <T v="h">{SKILLS[s].label}</T>
                <T v="small" c="text3">
                  {SKILLS[s].labelKo}
                </T>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <T v="num" style={{ fontSize: 26 }}>
                  {Math.round(masteryFromTheta(data.skills[s].theta))}
                </T>
                <Trend value={v.trend} />
              </View>
            </Row>
          );
        })}
        <Row style={{ justifyContent: 'flex-end', paddingBottom: space.xs }}>
          <T v="small" c="text3">
            왜 이 순서인가
          </T>
          <IconChevron color={p.text3} size={14} />
        </Row>
      </Card>

      <SectionTitle right={<T v="small" c="text3">{trainedToday ? '오늘 1회 완료' : plan.mode === 'exam' ? 'EXAM' : 'TRAINING'}</T>}>Today</SectionTitle>
      <Card>
        <Row style={{ alignItems: 'baseline' }}>
          <T v="display">{Math.round(plan.estimatedSeconds / 60)}</T>
          <T v="h" c="text2">
            min
          </T>
        </Row>
        <Spacer h={space.m} />
        <StackBar parts={groups.map((g) => ({ value: plan.groupCounts[g] ?? 0, color: groupColor(g, p) }))} />
        <Spacer h={space.m} />
        {groups.map((g) => (
          <Row key={g} style={{ justifyContent: 'space-between', paddingVertical: 5 }}>
            <Row>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: groupColor(g, p) }} />
              <T>{GROUP_LABEL[g]}</T>
            </Row>
            <T v="h" style={{ fontVariant: ['tabular-nums'] }}>
              {plan.groupCounts[g]}
            </T>
          </Row>
        ))}
      </Card>

      <Spacer h={space.l} />
      <Button testID="start-training" title={runtime ? '이어서 하기' : trainedToday ? '한 세션 더 하기' : "START TODAY'S TRAINING"} onPress={() => begin('training')} />
      <Row style={{ marginTop: space.s }}>
        <Button kind="secondary" small title="실전 모드" onPress={() => begin('exam')} style={{ flex: 1 }} />
        <Button kind="secondary" small title={`오답 다시보기 ${reviewCount ? `(${reviewCount})` : ''}`} onPress={() => router.push('/review')} style={{ flex: 1 }} disabled={!reviewCount} />
      </Row>

      {improving.length ? (
        <>
          <SectionTitle>최근 향상</SectionTitle>
          <Card>
            {improving.map((v) => (
              <Row key={v.skill} style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
                <T>{v.label}</T>
                <Row>
                  <T v="h">{Math.round(v.masteryScore)}</T>
                  <Trend value={v.trend} />
                </Row>
              </Row>
            ))}
          </Card>
        </>
      ) : null}

      <SectionTitle>오늘의 설계 근거</SectionTitle>
      <Card>
        {plan.decisions.slice(0, 4).map((d, i) => (
          <T key={i} v="small" c="text2" style={{ marginBottom: 4 }}>
            · {d}
          </T>
        ))}
        {ai.state !== 'off' ? (
          <T v="small" c="text3" style={{ marginTop: 6 }}>
            AI 문제 풀 {data.pool.length}개 {ai.state === 'fetching' ? '· 생성 중' : ai.state === 'error' ? '· 서버 연결 실패 (오프라인 엔진 사용)' : ''}
          </T>
        ) : null}
      </Card>
    </Screen>
  );
}
