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
    background: '#0E1A14',
    surface: '#162312',
    surfaceSubtle: '#1E2D1A',
    surfaceBorder: '#2B3D28',
    textPrimary: '#F0F7F4',
    textSecondary: '#A8C4B8',
    textMuted: '#6B8F7E',
    textInverse: '#0E1A14',
    primary: '#3A8F6A',
    primaryLight: '#1D5842',
    primaryDark: '#2A6B4F',
    income: '#2DD4AA',
    incomeBg: '#0D3B2C',
    incomeBorder: '#1A5C42',
    expense: '#F07080',
    expenseBg: '#3D1018',
    expenseBorder: '#5C1A24',
    warning: '#E6B840',
    warningBg: '#3D2A00',
    warningBorder: '#6B4A00',
    info: '#60A5FA',
    infoBg: '#1E3A8A',
    infoBorder: '#1E40AF',
    capsuleLavender: '#2D3B6B',
    capsuleYellow: '#3D3500',
    capsuleRose: '#3D1228',
    capsuleMint: '#0D3B2C',
    capsuleOrange: '#3D1E00',
  },
};

export type ThemeColors = ColorTokens;
