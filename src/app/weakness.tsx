import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable } from 'react-native';
import { causeLabel, DISTRACTOR_LABEL } from '../domain/errorAnalysis';
import { countBy } from '../domain/insights';
import { computePriorities, TARGET_MASTERY } from '../domain/scheduler';
import { toView } from '../domain/skillModel';
import { SKILLS } from '../domain/skills';
import type { DistractorType, MistakeCause } from '../domain/types';
import { recentAttempts } from '../services/engine';
import { useData } from '../store/appStore';
import { SkillBar, Trend } from '../ui/charts';
import { Card, Chip, Empty, Row, Screen, SectionTitle, T } from '../ui/components';
import { IconClose } from '../ui/icons';
import { space, usePalette } from '../ui/theme';

export default function Weakness() {
  const data = useData();
  const p = usePalette();
  const now = Date.now();
  const pr = useMemo(() => (data ? computePriorities({ states: data.skills, recentAttempts: recentAttempts(data, now), budgetSeconds: 1800, now }) : []), [data, data?.attempts.length]);
  if (!data) return null;
  const weak = pr.filter((x) => !x.strong).sort((a, b) => b.components.value - a.components.value).slice(0, 3);
  const recent = recentAttempts(data, now).filter((a) => !a.correct);
  const causes = countBy(recent.map((a) => a.mistakeCauses[0]).filter(Boolean) as MistakeCause[]).slice(0, 5);
  const traps = countBy(recent.map((a) => a.chosenDistractorType).filter(Boolean) as DistractorType[]).slice(0, 5);
  const fragile = recentAttempts(data, now).filter((a) => a.correct && (a.confidence === 0 || a.plays >= 3)).length;

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <T v="label" c="text3">
          Weakness
        </T>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <IconClose color={p.text2} size={20} />
        </Pressable>
      </Row>
      <T v="title" style={{ marginTop: 4 }}>
        990을 막는 핵심 병목 3개
      </T>
      <T v="small" c="text3" style={{ marginTop: 4 }}>
        순위 = 시험 비중 × 990까지 남은 격차. 불확실성·정체·확신 오답은 오늘의 시간 배분에 추가 반영됩니다.
      </T>
      {weak.map((w, i) => {
        const v = toView(data.skills[w.skill]);
        return (
          <Card key={w.skill} style={{ marginTop: space.m }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T v="h">
                {i + 1}. {SKILLS[w.skill].label}
              </T>
              <Row>
                <T v="num" style={{ fontSize: 24 }}>
                  {Math.round(w.mastery)}
                </T>
                <Trend value={v.trend} />
              </Row>
            </Row>
            <T v="small" c="text3">
              {SKILLS[w.skill].labelKo} · 목표 {TARGET_MASTERY} · 시도 {v.attemptCount}회
            </T>
            <SkillBar value={w.mastery} sigmaBand={(1 - v.confidence) * 12} />
            <Row style={{ flexWrap: 'wrap', marginTop: space.s }}>
              {w.reasons.map((r) => (
                <Chip key={r} label={r} />
              ))}
            </Row>
          </Card>
        );
      })}

      <SectionTitle>최근 14일 오답 원인 (추정)</SectionTitle>
      <Card>
        {causes.length ? (
          causes.map((c) => (
            <Row key={c.key} style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
              <T>{causeLabel(c.key)}</T>
              <T v="h">{c.count}</T>
            </Row>
          ))
        ) : (
          <Empty title="아직 데이터가 부족합니다" sub="몇 세션 후 패턴이 나타납니다." />
        )}
      </Card>

      <SectionTitle>가장 많이 당한 함정</SectionTitle>
      <Card>
        {traps.length ? (
          traps.map((c) => (
            <Row key={c.key} style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
              <T>{DISTRACTOR_LABEL[c.key]}</T>
              <T v="h">{c.count}</T>
            </Row>
          ))
        ) : (
          <T v="small" c="text3">
            —
          </T>
        )}
        {fragile ? (
          <T v="small" c="text3" style={{ marginTop: space.s }}>
            불안정한 정답(확신 없음 또는 3회 이상 재생) {fragile}건 — 정답이어도 완전 숙달로 보지 않습니다.
          </T>
        ) : null}
      </Card>
    </Screen>
  );
}
