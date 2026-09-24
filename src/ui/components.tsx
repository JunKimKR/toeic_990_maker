import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Palette, radius, space, type, usePalette } from './theme';

export function Screen({ children, scroll = true, padded = true, bottom }: { children: React.ReactNode; scroll?: boolean; padded?: boolean; bottom?: React.ReactNode }) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const body = scroll ? (
    <ScrollView contentContainerStyle={{ padding: padded ? space.l : 0, paddingTop: insets.top + space.m, paddingBottom: space.xxl + (bottom ? 80 : 0) }} showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    <View style={{ flex: 1, padding: padded ? space.l : 0, paddingTop: insets.top + space.m }}>{children}</View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      {body}
      {bottom ? <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.l, paddingTop: space.s, paddingBottom: insets.bottom + space.m, backgroundColor: p.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.border }}>{bottom}</View> : null}
    </View>
  );
}

type TVariant = keyof typeof type;
export function T({ v = 'body', c, style, children, numberOfLines, selectable }: { v?: TVariant; c?: keyof Palette | string; style?: StyleProp<TextStyle>; children: React.ReactNode; numberOfLines?: number; selectable?: boolean }) {
  const p = usePalette();
  const color = c ? ((p as unknown as Record<string, string>)[c] ?? c) : p.text;
  return (
    <Text selectable={selectable} numberOfLines={numberOfLines} style={[type[v] as TextStyle, { color }, v === 'label' ? { textTransform: 'uppercase' } : null, style]}>
      {children}
    </Text>
  );
}

export function Card({ children, style, onPress, tone }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; tone?: 'good' | 'bad' | 'accent' }) {
  const p = usePalette();
  const border = tone === 'good' ? p.good : tone === 'bad' ? p.bad : tone === 'accent' ? p.accent : p.border;
  const s = [{ backgroundColor: p.surface, borderRadius: radius.l, borderWidth: StyleSheet.hairlineWidth, borderColor: border, padding: space.l }, style];
  if (onPress)
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [s, pressed && { opacity: 0.75 }]}>
        {children}
      </Pressable>
    );
  return <View style={s}>{children}</View>;
}

export function Button({ title, onPress, kind = 'primary', disabled, style, small, testID }: { title: string; onPress: () => void; kind?: 'primary' | 'secondary' | 'ghost' | 'danger'; disabled?: boolean; style?: StyleProp<ViewStyle>; small?: boolean; testID?: string }) {
  const p = usePalette();
  const bg = kind === 'primary' ? p.accent : kind === 'secondary' ? p.surface2 : kind === 'danger' ? p.badBg : 'transparent';
  const fg = kind === 'primary' ? p.accentText : kind === 'danger' ? p.bad : p.text;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        { backgroundColor: bg, borderRadius: radius.m, paddingVertical: small ? 9 : 15, paddingHorizontal: small ? 12 : 18, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : pressed ? 0.8 : 1 },
        kind === 'ghost' && { borderWidth: StyleSheet.hairlineWidth, borderColor: p.border },
        style,
      ]}
    >
      <Text style={{ color: fg, fontSize: small ? 14 : 16, fontWeight: '700', letterSpacing: 0.2 }}>{title}</Text>
    </Pressable>
  );
}

export function Row({ children, style, gap = space.s }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Spacer({ h = space.l }: { h?: number }) {
  return <View style={{ height: h }} />;
}

export function Divider() {
  const p = usePalette();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: p.border, marginVertical: space.m }} />;
}

export function Chip({ label, active, onPress, tone }: { label: string; active?: boolean; onPress?: () => void; tone?: 'good' | 'bad' | 'warn' }) {
  const p = usePalette();
  const color = tone === 'good' ? p.good : tone === 'bad' ? p.bad : tone === 'warn' ? p.warn : active ? p.accentText : p.text2;
  const bg = active ? p.accent : tone === 'good' ? p.goodBg : tone === 'bad' ? p.badBg : p.surface2;
  const inner = (
    <View style={{ backgroundColor: bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
      <Text style={{ color, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{inner}</Pressable> : inner;
}

export function Segmented<T extends string | number>({ options, value, onChange }: { options: { label: string; value: T }[]; value: T; onChange: (v: T) => void }) {
  const p = usePalette();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: p.surface2, borderRadius: radius.m, padding: 3 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={String(o.value)} onPress={() => onChange(o.value)} style={{ flex: 1, paddingVertical: 8, borderRadius: radius.s, backgroundColor: on ? p.surface : 'transparent', alignItems: 'center' }}>
            <Text style={{ color: on ? p.text : p.text2, fontWeight: on ? '700' : '500', fontSize: 13 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Stat({ value, label, sub, tone }: { value: string; label: string; sub?: string; tone?: 'good' | 'bad' }) {
  return (
    <View style={{ flex: 1 }}>
      <T v="label" c="text3">
        {label}
      </T>
      <T v="num" c={tone === 'good' ? 'good' : tone === 'bad' ? 'bad' : 'text'} style={{ marginTop: 2 }}>
        {value}
      </T>
      {sub ? (
        <T v="small" c="text3">
          {sub}
        </T>
      ) : null}
    </View>
  );
}

export function ProgressBar({ value, height = 4, color, style }: { value: number; height?: number; color?: string; style?: StyleProp<ViewStyle> }) {
  const p = usePalette();
  return (
    <View style={[{ height, backgroundColor: p.track, borderRadius: height, overflow: 'hidden' }, style]}>
      <View style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, height, backgroundColor: color ?? p.accent, borderRadius: height }} />
    </View>
  );
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <Row style={{ justifyContent: 'space-between', marginTop: space.xl, marginBottom: space.s }}>
      <T v="label" c="text3">
        {children}
      </T>
      {right}
    </Row>
  );
}

export function Loading({ label }: { label?: string }) {
  const p = usePalette();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.bg }}>
      <ActivityIndicator color={p.accent} />
      {label ? (
        <T v="small" c="text3" style={{ marginTop: space.m }}>
          {label}
        </T>
      ) : null}
    </View>
  );
}

export function Empty({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={{ paddingVertical: space.xxl, alignItems: 'center' }}>
      <T v="h">{title}</T>
      {sub ? (
        <T v="small" c="text3" style={{ marginTop: 6, textAlign: 'center' }}>
          {sub}
        </T>
      ) : null}
    </View>
  );
}

export const pct = (x: number | null | undefined, digits = 0) => (x == null ? '—' : `${(x * 100).toFixed(digits)}%`);
