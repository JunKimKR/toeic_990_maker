/** Hidden developer / debug dashboard (Settings → tap version 7 times). */
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { masteryFromTheta } from '../domain/skillModel';
import { SKILL_IDS, SKILLS } from '../domain/skills';
import type { Question } from '../domain/types';
import { useApp, useData } from '../store/appStore';
import { Bars } from '../ui/charts';
import { Card, Chip, Row, Screen, SectionTitle, Segmented, T } from '../ui/components';
import { IconClose } from '../ui/icons';
import { space, usePalette } from '../ui/theme';

function count<T extends string | number>(xs: T[]): [T, number][] {
  const m = new Map<T, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

export default function Dev() {
  const data = useData();
  const p = usePalette();
  const storageErrors = useApp((s) => s.storageErrors)();
  const [tab, setTab] = useState<'overview' | 'questions' | 'decisions'>('overview');
  const [openQ, setOpenQ] = useState<string | null>(null);
  const qs = useMemo(() => (data ? (Object.values(data.questions) as Question[]).sort((a, b) => b.generationTimestamp - a.generationTimestamp) : []), [data, data?.exposures.length]);
  if (!data) return null;
  const items = qs.flatMap((q) => q.items);
  const pos4 = [0, 0, 0, 0];
  const pos3 = [0, 0, 0];
  for (const it of items) (it.choices.length === 4 ? pos4 : pos3)[it.answerIndex]++;
  const g = data.genStats;
  const KV = ({ k, v }: { k: string; v: string | number }) => (
    <Row style={{ justifyContent: 'space-between', paddingVertical: 3 }}>
      <T v="small" c="text2">
        {k}
      </T>
      <T v="small" style={{ fontVariant: ['tabular-nums'] }}>
        {v}
      </T>
    </Row>
  );
  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <T v="label" c="text3">
          Developer Dashboard
        </T>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <IconClose color={p.text2} size={20} />
        </Pressable>
      </Row>
      <View style={{ marginTop: space.m }}>
        <Segmented options={[{ label: 'Overview', value: 'overview' }, { label: 'Questions', value: 'questions' }, { label: 'Decisions', value: 'decisions' }]} value={tab} onChange={setTab} />
      </View>

      {tab === 'overview' ? (
        <>
          <SectionTitle>Generation</SectionTitle>
          <Card>
            <KV k="questions shown (loaded window)" v={qs.length} />
            <KV k="AI pool (unseen)" v={data.pool.length} />
            <KV k="candidates generated" v={g.generated} />
            <KV k="accepted" v={g.accepted} />
            <KV k="quality rejects" v={g.qualityRejects} />
            <KV k="novelty relaxations" v={g.relaxations} />
            <KV k="format fallbacks" v={g.formatFallbacks} />
            <KV k="unfilled slots" v={g.failures} />
            <KV k="pool hits" v={g.poolHits} />
            <T v="small" c="text3" style={{ marginTop: 6 }}>
              duplicate rejects: {Object.entries(g.duplicateRejects).sort().map(([k, v]) => `${k} ${v}`).join(' · ') || '—'}
            </T>
            <T v="small" c="text3" style={{ marginTop: 4 }}>
              quality issues: {Object.entries(g.qualityIssues).slice(0, 8).map(([k, v]) => `${k.slice(0, 28)} ${v}`).join(' · ') || '—'}
            </T>
          </Card>
          <SectionTitle>Answer position (A/B/C/D)</SectionTitle>
          <Card>
            <Row>
              <Bars data={pos4.map((v, i) => ({ label: 'ABCD'[i], value: v }))} height={60} />
              <View style={{ width: space.l }} />
              <Bars data={pos3.map((v, i) => ({ label: 'ABC'[i], value: v }))} height={60} />
            </Row>
          </Card>
          <SectionTitle>Difficulty distribution</SectionTitle>
          <Card>
            <Bars data={[1, 2, 3, 4, 5].map((d) => ({ label: `D${d}`, value: items.filter((i) => i.difficulty === d).length }))} height={60} />
          </Card>
          <SectionTitle>By part / skill / situation / structure</SectionTitle>
          <Card>
            <T v="small" c="text2">
              {count(qs.map((q) => q.part)).map(([k, v]) => `${k} ${v}`).join(' · ')}
            </T>
            <T v="small" c="text3" style={{ marginTop: 6 }}>
              {count(items.map((i) => i.skill)).map(([k, v]) => `${SKILLS[k].label} ${v}`).join(' · ')}
            </T>
            <T v="small" c="text3" style={{ marginTop: 6 }}>
              {count(qs.filter((q) => q.part === 'P3' || q.part === 'P4').map((q) => q.situation)).map(([k, v]) => `${k} ${v}`).join(' · ')}
            </T>
            <T v="small" c="text3" style={{ marginTop: 6 }}>
              {count(qs.map((q) => q.questionStructure.split('.').slice(0, 2).join('.'))).slice(0, 14).map(([k, v]) => `${k} ${v}`).join(' · ')}
            </T>
            <T v="small" c="text3" style={{ marginTop: 6 }}>
              source: {count(qs.map((q) => q.sourceType)).map(([k, v]) => `${k} ${v}`).join(' · ')}
            </T>
          </Card>
          <SectionTitle>Skill state</SectionTitle>
          <Card>
            {SKILL_IDS.map((s) => {
              const st = data.skills[s];
              return (
                <Row key={s} style={{ justifyContent: 'space-between', paddingVertical: 2 }}>
                  <T v="small" style={{ flex: 1 }}>
                    {SKILLS[s].label}
                  </T>
                  <T v="small" c="text2" style={{ fontVariant: ['tabular-nums'] }}>
                    {masteryFromTheta(st.theta).toFixed(1)} · θ {st.theta.toFixed(2)} · σ {st.sigma.toFixed(2)} · n {st.attemptCount}
                  </T>
                </Row>
              );
            })}
          </Card>
          <SectionTitle>Storage</SectionTitle>
          <Card>
            <KV k="attempts" v={data.attempts.length} />
            <KV k="exposures (window)" v={data.exposures.length} />
            <KV k="exact hashes (all time)" v={data.exactHashes.length} />
            <KV k="family offsets" v={Object.keys(data.familyOffsets).length} />
            <KV k="storage errors" v={storageErrors.length} />
            {storageErrors.slice(-3).map((e, i) => (
              <T key={i} v="small" c="bad">
                {e}
              </T>
            ))}
          </Card>
        </>
      ) : null}

      {tab === 'questions' ? (
        <>
          <SectionTitle>Recent generated questions</SectionTitle>
          {qs.slice(0, 60).map((q) => (
            <Card key={q.id} style={{ marginBottom: space.s }} onPress={() => setOpenQ(openQ === q.id ? null : q.id)}>
              <Row style={{ flexWrap: 'wrap' }}>
                <Chip label={q.part} />
                <Chip label={q.sourceType} />
                <Chip label={`D${q.difficulty}`} />
                <Chip label={`Q${q.qualityScore ?? '?'}`} tone={(q.qualityScore ?? 0) >= 90 ? 'good' : 'warn'} />
              </Row>
              <T v="small" c="text2" style={{ marginTop: 6 }}>
                {q.reasoningPath}
              </T>
              <T v="small" numberOfLines={openQ === q.id ? undefined : 2} style={{ marginTop: 4 }}>
                {q.items[0]?.stem}
              </T>
              {openQ === q.id ? (
                <View style={{ marginTop: 6 }}>
                  {q.audioScript?.map((l, i) => (
                    <T key={i} v="small" c="text3">
                      {l.speaker}: {l.text}
                    </T>
                  ))}
                  {q.items.map((it) => (
                    <View key={it.id} style={{ marginTop: 6 }}>
                      <T v="small">{it.stem}</T>
                      {it.choices.map((c, i) => (
                        <T key={i} v="small" c={i === it.answerIndex ? 'good' : 'text3'}>
                          {'ABCD'[i]}. {c.text} {c.distractorType ? `[${c.distractorType}]` : ''}
                        </T>
                      ))}
                    </View>
                  ))}
                  {q.qualityNotes?.length ? (
                    <T v="small" c="warn" style={{ marginTop: 4 }}>
                      {q.qualityNotes.join(' | ')}
                    </T>
                  ) : null}
                </View>
              ) : null}
            </Card>
          ))}
        </>
      ) : null}

      {tab === 'decisions' ? (
        <>
          <SectionTitle>Recent adaptive decisions</SectionTitle>
          <Card>
            {data.decisions
              .slice(-80)
              .reverse()
              .map((d, i) => (
                <T key={i} v="small" c={d.kind === 'in_session' ? 'text' : 'text2'} style={{ marginBottom: 4 }}>
                  {new Date(d.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} [{d.kind}] {d.message}
                </T>
              ))}
          </Card>
          <SectionTitle>Generation jobs</SectionTitle>
          <Card>
            {data.jobs
              .slice(-30)
              .reverse()
              .map((j) => (
                <T key={j.id} v="small" c={j.accepted ? 'text2' : 'bad'} style={{ marginBottom: 3 }}>
                  {j.part}/{SKILLS[j.slotSkill]?.label} · {j.source} · attempts {j.attempts}
                  {j.rejectReasons.length ? ` · ${j.rejectReasons.slice(-1)[0]}` : ''}
                </T>
              ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
