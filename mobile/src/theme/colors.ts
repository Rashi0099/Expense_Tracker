/**
 * Financial Design System Colors (Section 12 & 16)
 *
 * Provides full parity with the web brand tokens:
 * - Neutral: Slate scale (light & dark variants)
 * - Primary: Indigo accent
 * - Status: Emerald for Income (+), Rose for Expenses (-), Amber for Budgets (!)
 */

export interface ColorTokens {
  background: string;
  surface: string;
  surfaceSubtle: string;
  surfaceBorder: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  primary: string;
  primaryLight: string;
  primaryDark: string;
  income: string;
  incomeBg: string;
  incomeBorder: string;
  expense: string;
  expenseBg: string;
  expenseBorder: string;
  warning: string;
  warningBg: string;
  warningBorder: string;
  info: string;
  infoBg: string;
  infoBorder: string;
  capsuleLavender: string;
  capsuleYellow: string;
  capsuleRose: string;
  capsuleMint: string;
  capsuleOrange: string;
}

export const colors: { light: ColorTokens; dark: ColorTokens } = {
  light: {
    background: '#F7F1E5',
    surface: '#FFFDF8',
    surfaceSubtle: '#F2EAE0',
    surfaceBorder: '#E7D788',
    textPrimary: '#17233C',
    textSecondary: '#718096',
    textMuted: '#8E9BAE',
    textInverse: '#FFFFFF',
    primary: '#1D5842',
    primaryLight: '#E6F0EC',
    primaryDark: '#134030',
    income: '#16A085',
    incomeBg: '#E8F8F5',
    incomeBorder: '#C2F0E5',
    expense: '#E05D6A',
    expenseBg: '#FDE8E9',
    expenseBorder: '#FCD2D6',
    warning: '#D99A27',
    warningBg: '#FEF5E7',
    warningBorder: '#FAD7A0',
    info: '#2563EB',
    infoBg: '#EFF6FF',
    infoBorder: '#BFDBFE',
    capsuleLavender: '#E0E7FF',
    capsuleYellow: '#FEF3C7',
    capsuleRose: '#FCE7F3',
    capsuleMint: '#D1FAE5',
    capsuleOrange: '#FFEDD5',
  },
  dark: {
    background: '#0F1729',
    surface: '#161F35',
    surfaceSubtle: '#1C2840',
    surfaceBorder: '#263352',
    textPrimary: '#E8EDF8',
    textSecondary: '#9AAAC8',
    textMuted: '#5A6A8A',
    textInverse: '#0F1729',
    primary: '#4F8EF7',
    primaryLight: '#1E3A7A',
    primaryDark: '#3570D4',
    income: '#34D9A5',
    incomeBg: '#0D2E3F',
    incomeBorder: '#1A4F6A',
    expense: '#F07080',
    expenseBg: '#2E1020',
    expenseBorder: '#5C1A2E',
    warning: '#F0C040',
    warningBg: '#2E2400',
    warningBorder: '#5A4500',
    info: '#60A5FA',
    infoBg: '#1A2E5A',
    infoBorder: '#1E3A8A',
    capsuleLavender: '#1E2A5A',
    capsuleYellow: '#2E2800',
    capsuleRose: '#2E0F1F',
    capsuleMint: '#0A2535',
    capsuleOrange: '#2E1800',
  },
};

export type ThemeColors = ColorTokens;
