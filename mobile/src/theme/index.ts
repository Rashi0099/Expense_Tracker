import { colors, ThemeColors } from './colors';
import { typography } from './typography';
import { spacing, borderRadius } from './spacing';

export interface Theme {
  isDark: boolean;
  colors: ThemeColors;
  typography: typeof typography;
  spacing: typeof spacing;
  borderRadius: typeof borderRadius;
}

export const lightTheme: Theme = {
  isDark: false,
  colors: colors.light,
  typography,
  spacing,
  borderRadius,
};

export const darkTheme: Theme = {
  isDark: true,
  colors: colors.dark,
  typography,
  spacing,
  borderRadius,
};

export * from './colors';
export * from './typography';
export * from './spacing';
