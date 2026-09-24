import { useColorScheme } from 'react-native';
import { useApp } from '../store/appStore';

/**
 * Design tokens. Minimal, high-contrast, performance-dashboard feel:
 * flat surfaces, hairline borders, one accent, semantic green/red.
 */
export interface Palette {
  bg: string;
  surface: string;
  surface2: string;
  border: string;
  text: string;
  text2: string;
  text3: string;
  accent: string;
  accentText: string;
  good: string;
  bad: string;
  warn: string;
  goodBg: string;
  badBg: string;
  track: string;
  dark: boolean;
}

export const LIGHT: Palette = {
  bg: '#F6F6F4',
  surface: '#FFFFFF',
  surface2: '#EFEFEC',
  border: '#E2E2DE',
  text: '#101112',
  text2: '#55585D',
  text3: '#8C8F94',
  accent: '#1F5CFF',
  accentText: '#FFFFFF',
  good: '#138A4B',
  bad: '#D23B2F',
  warn: '#B7791F',
  goodBg: '#E3F4EA',
  badBg: '#FBE6E4',
  track: '#E6E6E2',
  dark: false,
};

export const DARK: Palette = {
  bg: '#0B0C0E',
  surface: '#141518',
  surface2: '#1C1E22',
  border: '#26282D',
  text: '#F2F3F5',
  text2: '#A5A9B0',
  text3: '#6D7178',
  accent: '#C8F03C',
  accentText: '#0B0C0E',
  good: '#3DD68C',
  bad: '#FF6B5E',
  warn: '#F2B94B',
  goodBg: '#10291D',
  badBg: '#2E1512',
  track: '#23252A',
  dark: true,
};

export const space = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 } as const;
export const radius = { s: 6, m: 10, l: 14 } as const;
export const type = {
  display: { fontSize: 34, fontWeight: '700' as const, letterSpacing: -0.8 },
  title: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.3 },
  h: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 23 },
  small: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  label: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.1 },
  num: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.5, fontVariant: ['tabular-nums' as const] },
};

export function usePalette(): Palette {
  const scheme = useColorScheme();
  const pref = useApp((s) => s.data?.profile.settings.theme ?? 'system');
  const dark = pref === 'dark' || (pref === 'system' && scheme === 'dark');
  return dark ? DARK : LIGHT;
}
