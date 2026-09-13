/**
 * Financial Semantic Cue System (Section 36)
 *
 * Ensures consistent financial meaning across the mobile application:
 * - Income (+, green, arrow-up / check)
 * - Expense (-, rose, arrow-down)
 * - Budget warning (!, amber, alert-triangle)
 * - Over budget (🚨, rose/crimson, alert-circle)
 * - Synced (✓, green/indigo, check-circle)
 * - Sync issue / Error (⚠️, warning amber/red)
 * - Offline (○, muted slate)
 *
 * CRITICAL ACCESSIBILITY RULE:
 * Never rely on color alone. Every status cue must provide an associated
 * visual icon/sign and an explicit textual accessibility label.
 */

import { ColorTokens, colors } from './colors';

export type FinancialSemanticType =
  | 'INCOME'
  | 'EXPENSE'
  | 'BUDGET_ON_TRACK'
  | 'BUDGET_WARNING'
  | 'BUDGET_OVER_LIMIT'
  | 'SYNCED'
  | 'SYNCING'
  | 'SYNC_ISSUE'
  | 'OFFLINE';

export interface FinancialCue {
  type: FinancialSemanticType;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
  sign: string;
  label: string;
  accessibilityLabel: string;
}

export function getFinancialCue(
  type: FinancialSemanticType,
  themeTokens: ColorTokens = colors.light
): FinancialCue {
  switch (type) {
    case 'INCOME':
      return {
        type,
        color: themeTokens.income,
        bgColor: themeTokens.incomeBg,
        borderColor: themeTokens.incomeBorder,
        icon: '▲',
        sign: '+',
        label: 'Income',
        accessibilityLabel: 'Income, credit stream',
      };

    case 'EXPENSE':
      return {
        type,
        color: themeTokens.expense,
        bgColor: themeTokens.expenseBg,
        borderColor: themeTokens.expenseBorder,
        icon: '▼',
        sign: '-',
        label: 'Expense',
        accessibilityLabel: 'Expense, debit transaction',
      };

    case 'BUDGET_ON_TRACK':
      return {
        type,
        color: themeTokens.income,
        bgColor: themeTokens.incomeBg,
        borderColor: themeTokens.incomeBorder,
        icon: '✓',
        sign: '',
        label: 'On Track',
        accessibilityLabel: 'Budget on track, spending is within 80% ceiling',
      };

    case 'BUDGET_WARNING':
      return {
        type,
        color: themeTokens.warning,
        bgColor: themeTokens.warningBg,
        borderColor: themeTokens.warningBorder,
        icon: '⚠️',
        sign: '!',
        label: 'Near Limit',
        accessibilityLabel: 'Budget warning, spending has reached or exceeded 80% of limit',
      };

    case 'BUDGET_OVER_LIMIT':
      return {
        type,
        color: themeTokens.expense,
        bgColor: themeTokens.expenseBg,
        borderColor: themeTokens.expenseBorder,
        icon: '🚨',
        sign: '!',
        label: 'Over Budget',
        accessibilityLabel: 'Budget exceeded, monthly spending is over 100% of allocation',
      };

    case 'SYNCED':
      return {
        type,
        color: themeTokens.income,
        bgColor: themeTokens.incomeBg,
        borderColor: themeTokens.incomeBorder,
        icon: '✓',
        sign: '',
        label: 'Synced',
        accessibilityLabel: 'All local changes are synchronized with the server',
      };

    case 'SYNCING':
      return {
        type,
        color: themeTokens.primary,
        bgColor: themeTokens.primaryLight,
        borderColor: themeTokens.surfaceBorder,
        icon: '↻',
        sign: '',
        label: 'Syncing',
        accessibilityLabel: 'Synchronizing changes with server in background',
      };

    case 'SYNC_ISSUE':
      return {
        type,
        color: themeTokens.warning,
        bgColor: themeTokens.warningBg,
        borderColor: themeTokens.warningBorder,
        icon: '⚠️',
        sign: '!',
        label: 'Sync Issue',
        accessibilityLabel: 'Some changes could not sync. Tap to retry.',
      };

    case 'OFFLINE':
      return {
        type,
        color: themeTokens.textMuted,
        bgColor: themeTokens.surfaceSubtle,
        borderColor: themeTokens.surfaceBorder,
        icon: '○',
        sign: '',
        label: 'Offline',
        accessibilityLabel: 'Device is offline. Changes are saved locally and will sync when connected.',
      };
  }
}
