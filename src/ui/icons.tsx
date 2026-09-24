import React from 'react';
import Svg, { Circle, Path, Polyline, Rect } from 'react-native-svg';

type P = { size?: number; color: string; strokeWidth?: number };

const S = ({ size = 22, children }: { size?: number; children: React.ReactNode }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {children}
  </Svg>
);

export const IconToday = ({ size, color, strokeWidth = 1.8 }: P) => (
  <S size={size}>
    <Circle cx={12} cy={12} r={8.5} stroke={color} strokeWidth={strokeWidth} />
    <Path d="M12 7.5V12l3 2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </S>
);
export const IconSkills = ({ size, color, strokeWidth = 1.8 }: P) => (
  <S size={size}>
    <Path d="M5 19V11M12 19V5M19 19v-5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </S>
);
export const IconVocab = ({ size, color, strokeWidth = 1.8 }: P) => (
  <S size={size}>
    <Path d="M5 5.5A1.5 1.5 0 0 1 6.5 4H19v14H6.5A1.5 1.5 0 0 0 5 19.5v-14Z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
    <Path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </S>
);
export const IconHistory = ({ size, color, strokeWidth = 1.8 }: P) => (
  <S size={size}>
    <Rect x={4} y={5} width={16} height={15} rx={2} stroke={color} strokeWidth={strokeWidth} />
    <Path d="M4 10h16M9 3v4M15 3v4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </S>
);
export const IconSettings = ({ size, color, strokeWidth = 1.8 }: P) => (
  <S size={size}>
    <Path d="M4 7h10M18 7h2M4 17h2M10 17h10" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <Circle cx={16} cy={7} r={2} stroke={color} strokeWidth={strokeWidth} />
    <Circle cx={8} cy={17} r={2} stroke={color} strokeWidth={strokeWidth} />
  </S>
);
export const IconPlay = ({ size, color }: P) => (
  <S size={size}>
    <Path d="M8 5.5v13l10.5-6.5L8 5.5Z" fill={color} />
  </S>
);
export const IconStop = ({ size, color }: P) => (
  <S size={size}>
    <Rect x={7} y={7} width={10} height={10} rx={1.5} fill={color} />
  </S>
);
export const IconReplay = ({ size, color, strokeWidth = 1.8 }: P) => (
  <S size={size}>
    <Path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <Polyline points="4 4 4.5 8 8.5 7.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
  </S>
);
export const IconClose = ({ size, color, strokeWidth = 2 }: P) => (
  <S size={size}>
    <Path d="M6 6l12 12M18 6 6 18" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </S>
);
export const IconChevron = ({ size, color, strokeWidth = 2 }: P) => (
  <S size={size}>
    <Path d="m9 6 6 6-6 6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
  </S>
);
export const IconUp = ({ size = 12, color }: P) => (
  <S size={size}>
    <Path d="M12 5 5 14h14L12 5Z" fill={color} />
  </S>
);
export const IconDown = ({ size = 12, color }: P) => (
  <S size={size}>
    <Path d="M12 19 5 10h14l-7 9Z" fill={color} />
  </S>
);
export const IconHeadphones = ({ size, color, strokeWidth = 1.8 }: P) => (
  <S size={size}>
    <Path d="M4 15v-3a8 8 0 0 1 16 0v3" stroke={color} strokeWidth={strokeWidth} />
    <Rect x={3.5} y={14} width={4} height={6} rx={1.5} stroke={color} strokeWidth={strokeWidth} />
    <Rect x={16.5} y={14} width={4} height={6} rx={1.5} stroke={color} strokeWidth={strokeWidth} />
  </S>
);
