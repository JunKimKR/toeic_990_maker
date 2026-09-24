import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Platform, Pressable, Switch, TextInput, View } from 'react-native';
import { checkBackend } from '../../services/aiClient';
import { useApp, useData } from '../../store/appStore';
import { Button, Card, Row, Screen, SectionTitle, Segmented, T } from '../../ui/components';
import { radius, space, usePalette } from '../../ui/theme';

export default function Settings() {
  const data = useData();
  const update = useApp((s) => s.updateSettings);
  const reset = useApp((s) => s.resetAll);
  const refill = useApp((s) => s.refillPool);
  const p = usePalette();
  const [url, setUrl] = useState(data?.profile.settings.apiBaseUrl ?? '');
  const [conn, setConn] = useState<string>('');
  const [taps, setTaps] = useState(0);
  if (!data) return null;
  const s = data.profile.settings;

  const Toggle = ({ label, sub, value, onChange }: { label: string; sub?: string; value: boolean; onChange(v: boolean): void }) => (
    <Row style={{ justifyContent: 'space-between', paddingVertical: space.s }}>
      <View style={{ flex: 1 }}>
        <T>{label}</T>
        {sub ? (
          <T v="small" c="text3">
            {sub}
          </T>
        ) : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: p.accent, false: p.track }} thumbColor={p.surface} />
    </Row>
  );

  const confirmReset = () => {
    const go = () => reset();
    if (Platform.OS === 'web') return go();
    Alert.alert('모든 학습 데이터를 삭제할까요?', 'Skill 추정치는 ETS 성적표 초기값으로 돌아갑니다.', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: go },
    ]);
  };

  return (
    <Screen>
      <T v="label" c="text3">
        Settings
      </T>
      <SectionTitle>하루 학습시간</SectionTitle>
      <Segmented options={[15, 20, 30, 45, 60].map((m) => ({ label: `${m}분`, value: m }))} value={s.dailyMinutes} onChange={(v) => update({ dailyMinutes: v })} />
      <SectionTitle>난이도</SectionTitle>
      <Segmented options={[{ label: '조금 쉽게', value: -1 }, { label: '자동', value: 0 }, { label: '더 어렵게', value: 1 }]} value={s.difficultyBias} onChange={(v) => update({ difficultyBias: v as -1 | 0 | 1 })} />
      <SectionTitle>기본 모드</SectionTitle>
      <Segmented options={[{ label: 'Training', value: 'training' }, { label: 'Exam', value: 'exam' }]} value={s.mode} onChange={(v) => update({ mode: v as 'training' | 'exam' })} />
      <T v="small" c="text3" style={{ marginTop: 6 }}>
        Training: 사고 과정 질문·해설·재청취 허용. Exam: 1회 재생, 시간 제한, 해설은 종료 후.
      </T>

      <SectionTitle>음성</SectionTitle>
      <Card>
        <T v="small" c="text3">
          음성 속도
        </T>
        <Segmented options={[0.85, 0.95, 1, 1.1, 1.2].map((r) => ({ label: `${r}x`, value: r }))} value={s.speechRate} onChange={(v) => update({ speechRate: v })} />
        <T v="small" c="text3" style={{ marginTop: space.m }}>
          TTS 엔진
        </T>
        <Segmented options={[{ label: '기기 음성 (오프라인)', value: 'device' }, { label: '서버 뉴럴 음성', value: 'remote' }]} value={s.ttsProvider} onChange={(v) => update({ ttsProvider: v as 'device' | 'remote' })} />
        {s.ttsProvider === 'remote' && !s.apiBaseUrl ? (
          <T v="small" c="warn" style={{ marginTop: 6 }}>
            서버 주소가 없으면 기기 음성으로 재생됩니다.
          </T>
        ) : null}
        <Toggle label="자동 재생" sub="문제가 열리면 바로 재생" value={s.autoPlay} onChange={(v) => update({ autoPlay: v })} />
        <Toggle label="답변 확신도 입력" sub="확신 없음 / 애매함 / 확신 버튼으로 제출" value={s.askConfidence} onChange={(v) => update({ askConfidence: v })} />
      </Card>

      <SectionTitle>화면</SectionTitle>
      <Segmented options={[{ label: '시스템', value: 'system' }, { label: '라이트', value: 'light' }, { label: '다크', value: 'dark' }]} value={s.theme} onChange={(v) => update({ theme: v as 'system' | 'light' | 'dark' })} />

      <SectionTitle>AI 문제 생성 서버 (선택)</SectionTitle>
      <Card>
        <T v="small" c="text3">
          API 키는 앱에 저장되지 않습니다. 직접 배포한 백엔드(server/) 주소만 입력하세요. 비워두면 오프라인 생성 엔진만 사용합니다.
        </T>
        <TextInput
          value={url}
          onChangeText={setUrl}
          placeholder="https://your-backend.example.com"
          placeholderTextColor={p.text3}
          autoCapitalize="none"
          autoCorrect={false}
          style={{ marginTop: space.s, borderWidth: 0.5, borderColor: p.border, borderRadius: radius.m, padding: space.m, color: p.text, backgroundColor: p.surface2 }}
        />
        <Row style={{ marginTop: space.s }}>
          <Button
            small
            kind="secondary"
            title="저장 & 연결 확인"
            style={{ flex: 1 }}
            onPress={async () => {
              update({ apiBaseUrl: url.trim() });
              if (!url.trim()) return setConn('오프라인 엔진만 사용');
              setConn('확인 중…');
              const r = await checkBackend(url.trim());
              setConn(r.ok ? `연결됨 · LLM ${r.provider ?? '?'} · TTS ${r.tts ?? '?'}` : `연결 실패 (${r.error})`);
              if (r.ok) refill();
            }}
          />
        </Row>
        {conn ? (
          <T v="small" c="text2" style={{ marginTop: 6 }}>
            {conn}
          </T>
        ) : null}
        <T v="small" c="text3" style={{ marginTop: 6 }}>
          AI 문제 풀: {data.pool.length}개 대기
        </T>
      </Card>

      <SectionTitle>데이터</SectionTitle>
      <Button kind="danger" title="학습 데이터 초기화" onPress={confirmReset} />
      {s.developerMode ? <Button kind="secondary" title="Developer Dashboard" onPress={() => router.push('/dev')} style={{ marginTop: space.s }} /> : null}

      <Pressable
        onPress={() => {
          const n = taps + 1;
          setTaps(n);
          if (n >= 7 && !s.developerMode) update({ developerMode: true });
        }}
      >
        <T v="small" c="text3" style={{ textAlign: 'center', marginTop: space.xl }}>
          TOEIC 990 Adaptive Trainer · v1.0.0{s.developerMode ? ' · dev' : ''}
        </T>
      </Pressable>
    </Screen>
  );
}
