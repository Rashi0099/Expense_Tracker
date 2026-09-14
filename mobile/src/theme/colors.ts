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
    background: '#0B0F19',
    surface: '#161E2E',
    surfaceSubtle: '#1F293D',
    surfaceBorder: '#2E384D',
    textPrimary: '#F8FAFC',
    textSecondary: '#CBD5E1',
    textMuted: '#64748B',
    textInverse: '#0F172A',
    primary: '#6366F1',
    primaryLight: '#312E81',
    primaryDark: '#4338CA',
    income: '#34D399',
    incomeBg: '#064E3B',
    incomeBorder: '#065F46',
    expense: '#FB7185',
    expenseBg: '#881337',
    expenseBorder: '#9F1239',
    warning: '#FBBF24',
    warningBg: '#78350F',
    warningBorder: '#92400E',
    info: '#60A5FA',
    infoBg: '#1E3A8A',
    infoBorder: '#1E40AF',
    capsuleLavender: '#8B9BD8',
    capsuleYellow: '#C7BD73',
    capsuleRose: '#D989A0',
    capsuleMint: '#79C9AA',
    capsuleOrange: '#DCAC76',
  },
};

export type ThemeColors = ColorTokens;
