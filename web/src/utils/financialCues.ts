/**
 * Financial Semantic Cue System (Web Parity)
 *
 * Ensures consistent financial meaning across the web application:
 * - Income (+, green/emerald, arrow-up ▲)
 * - Expense (-, rose, arrow-down ▼)
 * - Budget on track (✓, green/emerald)
 * - Budget warning (⚠️, amber)
 * - Over budget (🚨, rose/crimson)
 * - Synced (✓, green)
 * - Offline (○, slate)
 *
 * CRITICAL ACCESSIBILITY RULE:
 * Never rely on color alone. Every status cue must provide an associated
 * visual icon/sign and an explicit textual accessibility label.
 */

export type FinancialSemanticType =
  | 'INCOME'
  | 'EXPENSE'
  | 'BUDGET_ON_TRACK'
  | 'BUDGET_WARNING'
  | 'BUDGET_OVER_LIMIT'
  | 'SYNCED'
  | 'SYNCING'
  | 'OFFLINE';

export interface WebFinancialCue {
  type: FinancialSemanticType;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  icon: string;
  sign: string;
  label: string;
  accessibilityLabel: string;
}

export function getWebFinancialCue(type: FinancialSemanticType): WebFinancialCue {
  switch (type) {
    case 'INCOME':
      return {
        type,
        colorClass: 'text-emerald-600 dark:text-emerald-400',
        bgClass: 'bg-emerald-50 dark:bg-emerald-950/30',
        borderClass: 'border-emerald-200 dark:border-emerald-800',
        icon: '▲',
        sign: '+',
        label: 'Income',
        accessibilityLabel: 'Income, credit stream',
      };

    case 'EXPENSE':
      return {
        type,
        colorClass: 'text-rose-600 dark:text-rose-400',
        bgClass: 'bg-rose-50 dark:bg-rose-950/30',
        borderClass: 'border-rose-200 dark:border-rose-800',
        icon: '▼',
        sign: '-',
        label: 'Expense',
        accessibilityLabel: 'Expense, debit transaction',
      };

    case 'BUDGET_ON_TRACK':
      return {
        type,
        colorClass: 'text-emerald-600 dark:text-emerald-400',
        bgClass: 'bg-emerald-50 dark:bg-emerald-950/30',
        borderClass: 'border-emerald-200 dark:border-emerald-800',
        icon: '✓',
        sign: '',
        label: 'On Track',
        accessibilityLabel: 'Budget on track, spending is within 80% ceiling',
      };

    case 'BUDGET_WARNING':
      return {
        type,
        colorClass: 'text-amber-600 dark:text-amber-400',
        bgClass: 'bg-amber-50 dark:bg-amber-950/30',
        borderClass: 'border-amber-200 dark:border-amber-800',
        icon: '⚠️',
        sign: '!',
        label: 'Near Limit',
        accessibilityLabel: 'Budget warning, spending has reached or exceeded 80% of limit',
      };

    case 'BUDGET_OVER_LIMIT':
      return {
        type,
        colorClass: 'text-rose-600 dark:text-rose-400',
        bgClass: 'bg-rose-50 dark:bg-rose-950/30',
        borderClass: 'border-rose-200 dark:border-rose-800',
        icon: '🚨',
        sign: '!',
        label: 'Over Budget',
        accessibilityLabel: 'Budget exceeded, monthly spending is over 100% of allocation',
      };

    case 'SYNCED':
      return {
        type,
        colorClass: 'text-emerald-600 dark:text-emerald-400',
        bgClass: 'bg-emerald-50 dark:bg-emerald-950/30',
        borderClass: 'border-emerald-200 dark:border-emerald-800',
        icon: '✓',
        sign: '',
        label: 'Synced',
        accessibilityLabel: 'All local changes are synchronized with the server',
      };

    case 'SYNCING':
      return {
        type,
        colorClass: 'text-indigo-600 dark:text-indigo-400',
        bgClass: 'bg-indigo-50 dark:bg-indigo-950/30',
        borderClass: 'border-indigo-200 dark:border-indigo-800',
        icon: '↻',
        sign: '',
        label: 'Syncing',
        accessibilityLabel: 'Synchronizing changes with server in background',
      };

    case 'OFFLINE':
      return {
        type,
        colorClass: 'text-slate-500 dark:text-slate-400',
        bgClass: 'bg-slate-100 dark:bg-slate-800',
        borderClass: 'border-slate-200 dark:border-slate-700',
        icon: '○',
        sign: '',
        label: 'Offline',
        accessibilityLabel: 'Device is offline',
      };
  }
}
