import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { intervalDays, isDue } from '../../domain/vocabulary';
import { VOCAB_BY_WORD } from '../../generation/content/vocabBank';
import { useApp, useData } from '../../store/appStore';
import { Button, Card, Chip, Empty, ProgressBar, Row, Screen, SectionTitle, T } from '../../ui/components';
import { space, usePalette } from '../../ui/theme';

const FORMAT_KO: Record<string, string> = { cloze: '빈칸', meaning: '의미', paraphrase: '동의어', listening: '듣기', context: '문맥' };

export default function Vocab() {
  const data = useData();
  const p = usePalette();
  const start = useApp((s) => s.start);
  const [open, setOpen] = useState<string | null>(null);
  if (!data) return null;
  const now = Date.now();
  const words = Object.values(data.vocab).sort((a, b) => Number(isDue(b, now)) - Number(isDue(a, now)) || a.mastery - b.mastery);
  const due = words.filter((w) => isDue(w, now) && w.mastery < 92);
  const mastered = words.filter((w) => w.mastery >= 92);
  return (
    <Screen>
      <T v="label" c="text3">
        Vocabulary
      </T>
      <T v="title" style={{ marginTop: 4 }}>
        실제로 틀리거나 느렸던 어휘
      </T>
      <T v="small" c="text3" style={{ marginTop: 4 }}>
        단어장이 아니라 문제 풀이에서 수집됩니다. 같은 문장은 재사용하지 않고 빈칸 → 의미 → 동의어 → 듣기 순으로 새 문맥에서 다시 나옵니다.
      </T>
      <Row style={{ marginTop: space.l }}>
        <Card style={{ flex: 1 }}>
          <T v="label" c="text3">
            복습 대상
          </T>
          <T v="num">{due.length}</T>
        </Card>
        <Card style={{ flex: 1 }}>
          <T v="label" c="text3">
            추적 중
          </T>
          <T v="num">{words.length}</T>
        </Card>
        <Card style={{ flex: 1 }}>
          <T v="label" c="text3">
            숙달
          </T>
          <T v="num">{mastered.length}</T>
        </Card>
      </Row>
      <Button
        title={due.length ? `취약 어휘 집중 (${Math.min(16, Math.max(8, due.length * 2))}문항)` : '어휘 드릴 (추천 단어)'}
        onPress={() => start('training', 'vocab') && router.push('/session')}
        style={{ marginTop: space.l }}
      />
      <SectionTitle>단어</SectionTitle>
      {words.length === 0 ? <Empty title="아직 수집된 어휘가 없습니다" sub="틀리거나 오래 고민한 어휘가 자동으로 추가됩니다." /> : null}
      {words.map((w) => {
        const e = VOCAB_BY_WORD[w.word];
        const isOpen = open === w.word;
        return (
          <Pressable key={w.word} onPress={() => setOpen(isOpen ? null : w.word)}>
            <View style={{ paddingVertical: space.m, borderBottomWidth: 0.5, borderBottomColor: p.border }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Row>
                    <T v="h">{w.word}</T>
                    <T v="small" c="text3">
                      {w.partOfSpeech}
                    </T>
                    {isDue(w, now) && w.mastery < 92 ? <Chip label="복습" tone="warn" /> : null}
                  </Row>
                  <T v="small" c="text2">
                    {w.meaning}
                  </T>
                </View>
                <View style={{ width: 70 }}>
                  <T v="small" c="text3" style={{ textAlign: 'right' }}>
                    {Math.round(w.mastery)}
                  </T>
                  <ProgressBar value={w.mastery / 100} color={w.mastery >= 80 ? p.good : w.mastery >= 50 ? p.text2 : p.bad} />
                </View>
              </Row>
              {isOpen ? (
                <View style={{ marginTop: space.s, gap: 4 }}>
                  <T v="small" c="text3">
                    연어: {w.collocations.join(', ') || '—'}
                  </T>
                  {e ? (
                    <T v="small" c="text3">
                      동의어: {e.syn.join(', ')}
                    </T>
                  ) : null}
                  <T v="small" c="text3">
                    만난 형식: {w.formatsSeen.map((f) => FORMAT_KO[f] ?? f).join(', ') || '—'} · {w.correctCount}/{w.encounterCount} 정답 · 다음 복습 {intervalDays(w.mastery)}일 간격
                  </T>
                  <T v="small" c="text2">
                    마지막 문맥: {w.context}
                  </T>
                </View>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </Screen>
  );
}
