import type { TextStyle } from 'react-native';

/**
 * Type scale. System font on both platforms (premium-but-neutral, best
 * dynamic-type behavior). Sizes are base values; RN font scaling applies
 * on top (accessibility requirement: layouts must survive 130%).
 */
export const typography = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: '700' },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '600' },
  headline: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  label: { fontSize: 14, lineHeight: 18, fontWeight: '500' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
} as const satisfies Record<string, TextStyle>;

export type TypographyToken = keyof typeof typography;
