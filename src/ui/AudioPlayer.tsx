import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { createTts, PlayOptions } from '../audio/tts';
import type { ScriptLine } from '../domain/types';
import { Chip, Row, T } from './components';
import { IconHeadphones, IconPlay, IconStop } from './icons';
import { radius, space, usePalette } from './theme';

export interface AudioPlayerProps {
  lines: ScriptLine[];
  playKey: string; // changes when the question changes
  provider: 'device' | 'remote' | 'mock';
  apiBaseUrl: string;
  rate: number;
  autoPlay: boolean;
  allowReplay: boolean;
  allowSpeed: boolean;
  pauses?: PlayOptions['pauses'];
  onPlay(count: number): void;
  onEnded(): void;
}

export function AudioPlayer(props: AudioPlayerProps) {
  const p = usePalette();
  const tts = useMemo(() => createTts(props.provider, props.apiBaseUrl), [props.provider, props.apiBaseUrl]);
  const stopRef = useRef<(() => void) | null>(null);
  const [playing, setPlaying] = useState(false);
  const [line, setLine] = useState(-1);
  const [plays, setPlays] = useState(0);
  const [rate, setRate] = useState(props.rate);
  const propsRef = useRef(props);
  propsRef.current = props;

  const stop = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    setPlaying(false);
  }, []);

  const play = useCallback(() => {
    stop();
    const n = plays + 1;
    setPlays(n);
    setPlaying(true);
    propsRef.current.onPlay(n);
    stopRef.current = tts.play(propsRef.current.lines, { rate, pauses: propsRef.current.pauses }, {
      onLine: (i) => setLine(i),
      onDone: () => {
        setPlaying(false);
        setLine(-1);
        stopRef.current = null;
        propsRef.current.onEnded();
      },
      onError: () => undefined,
    });
  }, [plays, rate, stop, tts]);

  // new question: reset and optionally auto-play
  useEffect(() => {
    stop();
    setPlays(0);
    setLine(-1);
    if (props.autoPlay) {
      const t = setTimeout(() => {
        setPlays(1);
        setPlaying(true);
        propsRef.current.onPlay(1);
        stopRef.current = tts.play(propsRef.current.lines, { rate, pauses: propsRef.current.pauses }, {
          onLine: (i) => setLine(i),
          onDone: () => {
            setPlaying(false);
            setLine(-1);
            stopRef.current = null;
            propsRef.current.onEnded();
          },
        });
      }, 450);
      return () => clearTimeout(t);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.playKey]);

  useEffect(() => () => stopRef.current?.(), []);

  const canPlay = !playing && (plays === 0 || props.allowReplay);
  const total = props.lines.length;

  return (
    <View style={{ backgroundColor: p.surface, borderRadius: radius.l, borderWidth: 0.5, borderColor: p.border, padding: space.l }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row>
          <IconHeadphones color={p.text2} size={18} />
          <T v="label" c="text3">
            {plays === 0 ? 'Listen' : `재생 ${plays}회`}
          </T>
          {plays > 1 ? <Chip label="재청취" tone="warn" /> : null}
        </Row>
        {props.allowSpeed ? (
          <Row gap={6}>
            {[0.9, 1, 1.1].map((r) => (
              <Chip key={r} label={`${r}x`} active={rate === r} onPress={() => setRate(r)} />
            ))}
          </Row>
        ) : null}
      </Row>
      <Row style={{ marginTop: space.l, gap: space.l }}>
        <Pressable
          testID="audio-play"
          accessibilityLabel={playing ? 'stop audio' : 'play audio'}
          onPress={() => (playing ? stop() : canPlay ? play() : undefined)}
          style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: playing || canPlay ? p.accent : p.surface2, alignItems: 'center', justifyContent: 'center' }}
        >
          {playing ? <IconStop color={p.accentText} size={22} /> : <IconPlay color={canPlay ? p.accentText : p.text3} size={24} />}
        </Pressable>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', gap: 3 }}>
            {Array.from({ length: total }, (_, i) => (
              <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: playing && i <= line ? p.accent : i < line ? p.accent : p.track }} />
            ))}
          </View>
          <T v="small" c="text3" style={{ marginTop: 8 }}>
            {playing ? '듣는 중 — 스크립트는 답 제출 후 공개' : plays === 0 ? '한 번에 듣고 푸는 것이 목표입니다' : props.allowReplay ? '다시 들으면 숙달 판정이 낮아집니다' : '실전 모드: 1회 재생'}
          </T>
        </View>
      </Row>
    </View>
  );
}
