/** Lightweight SVG charts (no chart library needed). */
import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path, Polygon, Rect, Text as SvgText } from 'react-native-svg';
import { usePalette } from './theme';
import { T, Row } from './components';
import { IconDown, IconUp } from './icons';

export function Sparkline({ values, width = 72, height = 22, color }: { values: number[]; width?: number; height?: number; color?: string }) {
  const p = usePalette();
  if (values.length < 2) return <View style={{ width, height }} />;
  const min = Math.min(...values) - 1;
  const max = Math.max(...values) + 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (width - 4) + 2, height - 2 - ((v - min) / (max - min)) * (height - 4)]);
  const d = pts.map((pt, i) => `${i ? 'L' : 'M'}${pt[0].toFixed(1)},${pt[1].toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return (
    <Svg width={width} height={height}>
      <Path d={d} stroke={color ?? p.text2} strokeWidth={1.5} fill="none" />
      <Circle cx={last[0]} cy={last[1]} r={2.2} fill={color ?? p.text} />
    </Svg>
  );
}

export function Trend({ value }: { value: number }) {
  const p = usePalette();
  if (Math.abs(value) < 0.3) return <T v="small" c="text3">—</T>;
  return (
    <Row gap={2}>
      {value > 0 ? <IconUp color={p.good} size={10} /> : <IconDown color={p.bad} size={10} />}
      <T v="small" c={value > 0 ? 'good' : 'bad'}>
        {Math.abs(value).toFixed(1)}
      </T>
    </Row>
  );
}

/** Skill bar with an uncertainty band and a 990-target tick. */
export function SkillBar({ value, sigmaBand = 0, target = 97.5 }: { value: number; sigmaBand?: number; target?: number }) {
  const p = usePalette();
  const color = value >= 90 ? p.good : value >= 80 ? p.text : p.bad;
  return (
    <View style={{ height: 8, backgroundColor: p.track, borderRadius: 4, overflow: 'hidden' }}>
      {sigmaBand > 0 ? <View style={{ position: 'absolute', left: `${Math.max(0, value - sigmaBand)}%`, width: `${Math.min(100, sigmaBand * 2)}%`, height: 8, backgroundColor: p.border }} /> : null}
      <View style={{ width: `${value}%`, height: 8, backgroundColor: color, borderRadius: 4 }} />
      <View style={{ position: 'absolute', left: `${target}%`, width: 2, height: 8, backgroundColor: p.accent }} />
    </View>
  );
}

export function Radar({ labels, values, size = 240 }: { labels: string[]; values: number[]; size?: number }) {
  const p = usePalette();
  const n = labels.length;
  const c = size / 2;
  const r = c - 34;
  const pt = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [c + Math.cos(a) * r * (v / 100), c + Math.sin(a) * r * (v / 100)];
  };
  const ring = (v: number) => Array.from({ length: n }, (_, i) => pt(i, v).join(',')).join(' ');
  return (
    <Svg width={size} height={size}>
      {[50, 75, 100].map((v) => (
        <Polygon key={v} points={ring(v)} fill="none" stroke={p.border} strokeWidth={1} />
      ))}
      {labels.map((_, i) => {
        const [x, y] = pt(i, 100);
        return <Line key={i} x1={c} y1={c} x2={x} y2={y} stroke={p.border} strokeWidth={1} />;
      })}
      <Polygon points={values.map((v, i) => pt(i, Math.max(40, v) === v ? v : 40).join(',')).join(' ')} fill={p.accent} fillOpacity={0.18} stroke={p.accent} strokeWidth={2} />
      {labels.map((l, i) => {
        const [x, y] = pt(i, 118);
        return (
          <SvgText key={l} x={x} y={y + 4} fontSize={10} fill={p.text2} textAnchor="middle">
            {l}
          </SvgText>
        );
      })}
    </Svg>
  );
}

/** Horizontal stacked composition bar (today's plan). */
export function StackBar({ parts, height = 10 }: { parts: { value: number; color: string }[]; height?: number }) {
  const total = parts.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <View style={{ flexDirection: 'row', height, borderRadius: height / 2, overflow: 'hidden', gap: 2 }}>
      {parts.map((x, i) => (
        <View key={i} style={{ flex: x.value / total, backgroundColor: x.color }} />
      ))}
    </View>
  );
}

export function Bars({ data, height = 90 }: { data: { label: string; value: number }[]; height?: number }) {
  const p = usePalette();
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = 28;
  return (
    <Svg width={data.length * (w + 10)} height={height + 18}>
      {data.map((d, i) => {
        const h = (d.value / max) * height;
        return (
          <React.Fragment key={d.label}>
            <Rect x={i * (w + 10)} y={height - h} width={w} height={h} rx={3} fill={p.text2} />
            <SvgText x={i * (w + 10) + w / 2} y={height + 13} fontSize={10} fill={p.text3} textAnchor="middle">
              {d.label}
            </SvgText>
            <SvgText x={i * (w + 10) + w / 2} y={Math.max(10, height - h - 3)} fontSize={10} fill={p.text} textAnchor="middle">
              {d.value}
            </SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}
