import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { readinessIndicators } from '../../domain/insights';
import { toView } from '../../domain/skillModel';
import { LC_SKILLS, RC_SKILLS, SKILLS } from '../../domain/skills';
import type { SkillId } from '../../domain/types';
import { useData } from '../../store/appStore';
import { Radar, SkillBar, Sparkline, Trend } from '../../ui/charts';
import { Card, Row, Screen, SectionTitle, Segmented, T, pct } from '../../ui/components';
import { space, usePalette } from '../../ui/theme';

export default function Skills() {
  const data = useData();
  const p = usePalette();
  const [sec, setSec] = useState<'LC' | 'RC'>('LC');
  const [open, setOpen] = useState<SkillId | null>(null);
  const views = useMemo(() => (data ? Object.fromEntries(Object.values(data.skills).map((s) => [s.skill, toView(s)])) : {}), [data, data?.attempts.length]);
  if (!data) return null;
  const ids = (sec === 'LC' ? LC_SKILLS : RC_SKILLS).slice().sort((a, b) => views[a].masteryScore - views[b].masteryScore);
  const radarIds = sec === 'LC' ? (['short_gist', 'extended_gist', 'short_detail', 'extended_detail', 'speaker_intent', 'implied_meaning', 'purpose_identification', 'next_action_prediction'] as SkillId[]) : (['vocabulary', 'grammar', 'inference', 'specific_information', 'cross_sentence_connection', 'paraphrase', 'purpose'] as SkillId[]);
  const ind = readinessIndicators(data.skills, data.attempts);

  return (
    <Screen>
      <T v="label" c="text3">
        Skill Map
      </T>
      <T v="title" style={{ marginTop: 4, marginBottom: space.m }}>
        현재 추정 능력
      </T>
      <Segmented options={[{ label: 'Listening', value: 'LC' }, { label: 'Reading', value: 'RC' }]} value={sec} onChange={setSec} />
      <View style={{ alignItems: 'center', marginVertical: space.m }}>
        <Radar labels={radarIds.map((s) => SKILLS[s].label.replace('Extended', 'Ext').replace('Speaker ', '').replace('LC ', '').replace('RC ', '').replace('Specific Info', 'Specific').replace('Cross-Sentence', 'Cross-sent.').replace('Implied Meaning', 'Implied'))} values={radarIds.map((s) => views[s].masteryScore)} size={280} />
      </View>
      <T v="small" c="text3">
        점수 = 표준 난도(TOEIC 평균 수준) 문항의 예상 정답률. 회색 띠 = 추정 불확실성, 파란 눈금 = 990 목표선.
      </T>

      <SectionTitle>{sec === 'LC' ? 'Listening' : 'Reading'} skills (약한 순)</SectionTitle>
      {ids.map((id) => {
        const v = views[id];
        const hist = data.skills[id].history.slice(-10).map((h) => h.mastery);
        const isOpen = open === id;
        return (
          <Pressable key={id} onPress={() => setOpen(isOpen ? null : id)}>
            <View style={{ paddingVertical: space.m, borderBottomWidth: 0.5, borderBottomColor: p.border }}>
              <Row style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                <View style={{ flex: 1 }}>
                  <T v="h">{v.label}</T>
                  <T v="small" c="text3">
                    {SKILLS[id].labelKo}
                  </T>
                </View>
                <Sparkline values={hist} />
                <View style={{ width: 56, alignItems: 'flex-end' }}>
                  <T v="h" style={{ fontVariant: ['tabular-nums'] }}>
                    {v.masteryScore.toFixed(0)}
                  </T>
                  <Trend value={v.trend} />
                </View>
              </Row>
              <SkillBar value={v.masteryScore} sigmaBand={(1 - v.confidence) * 12} />
              {isOpen ? (
                <Card style={{ marginTop: space.m }}>
                  <Row style={{ flexWrap: 'wrap', rowGap: 8 }}>
                    <Metric k="시도" v={String(v.attemptCount)} />
                    <Metric k="최근 정답률" v={pct(v.recentAccuracy)} />
                    <Metric k="가중 정답률" v={pct(v.weightedAccuracy)} />
                    <Metric k="난도 보정 정답률" v={pct(v.difficultyAdjustedAccuracy)} />
                    <Metric k="첫 시도 정답률" v={pct(v.firstAttemptAccuracy)} />
                    <Metric k="첫 청취 정답률" v={pct(v.firstListenAccuracy)} />
                    <Metric k="응답시간 중앙값" v={v.medianResponseTime ? `${(v.medianResponseTime / 1000).toFixed(1)}s` : '—'} />
                    <Metric k="추정 신뢰도" v={pct(v.confidence)} />
                  </Row>
                  <T v="small" c="text3" style={{ marginTop: space.s }}>
                    시작값 {data.skills[id].seedScore.toFixed(0)} (ETS 성적표 기반)
                  </T>
                </Card>
              ) : null}
            </View>
          </Pressable>
        );
      })}

      <SectionTitle>990 Readiness 지표 (객관 데이터만)</SectionTitle>
      <Card>
        {ind.map((i) => (
          <Row key={i.key} style={{ justifyContent: 'space-between', paddingVertical: 6 }}>
            <View style={{ flex: 1 }}>
              <T>{i.label}</T>
              <T v="small" c="text3">
                {i.note}
                {i.n ? ` · n=${i.n}` : ''}
              </T>
            </View>
            <T v="h">{i.value == null ? '—' : i.unit === '%' ? pct(i.value) : `${i.value.toFixed(1)}s`}</T>
          </Row>
        ))}
        <T v="small" c="text3" style={{ marginTop: space.s }}>
          공식 점수 예측은 표시하지 않습니다. 모의 문항과 실제 ETS 문항의 난도 대응을 검증할 데이터가 없기 때문입니다.
        </T>
      </Card>
    </Screen>
  );
}

function Metric({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ width: '50%' }}>
      <T v="small" c="text3">
        {k}
      </T>
      <T v="h">{v}</T>
    </View>
  );
}
