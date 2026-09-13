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
    background: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceSubtle: '#F1F5F9',
    surfaceBorder: '#E2E8F0',
    textPrimary: '#0F172A',
    textSecondary: '#475569',
    textMuted: '#94A3B8',
    textInverse: '#FFFFFF',
    primary: '#4F46E5',
    primaryLight: '#EEF2FF',
    primaryDark: '#3730A3',
    income: '#10B981',
    incomeBg: '#ECFDF5',
    incomeBorder: '#A7F3D0',
    expense: '#E11D48',
    expenseBg: '#FFF1F2',
    expenseBorder: '#FECDD3',
    warning: '#F59E0B',
    warningBg: '#FFFBEB',
    warningBorder: '#FDE68A',
    info: '#3B82F6',
    infoBg: '#EFF6FF',
    infoBorder: '#BFDBFE',
    capsuleLavender: '#B5C0EA',
    capsuleYellow: '#E6DE98',
    capsuleRose: '#F3B4C5',
    capsuleMint: '#A7E8D0',
    capsuleOrange: '#FAD2A4',
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
