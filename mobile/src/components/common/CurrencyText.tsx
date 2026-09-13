import React from 'react';
import { Text, TextStyle } from 'react-native';
import { formatCurrencyFromCents, dollarsToCents } from '../../utils/money';
import { useTheme } from '../../theme/useTheme';

export interface CurrencyTextProps {
  amountCents?: number;
  amountDecimal?: string | number;
  currency?: string;
  type?: 'income' | 'expense' | 'neutral';
  style?: TextStyle;
  showSign?: boolean;
  showIcon?: boolean;
}

export const CurrencyText: React.FC<CurrencyTextProps> = ({
  amountCents,
  amountDecimal,
  currency = 'USD',
  type = 'neutral',
  style,
  showSign = false,
  showIcon = false,
}) => {
  const { theme } = useTheme();

  const cents =
    amountCents !== undefined
      ? amountCents
      : amountDecimal !== undefined
      ? dollarsToCents(amountDecimal)
      : 0;

  const formatted = formatCurrencyFromCents(cents, currency);

  let color: string = theme.colors.textPrimary;
  let signPrefix = '';
  let iconPrefix = '';
  let accessibleLabel = formatted;

  if (type === 'income') {
    color = theme.colors.income;
    if (showSign && cents > 0) signPrefix = '+';
    if (showIcon) iconPrefix = '▲ ';
    accessibleLabel = `Income: +${formatted}`;
  } else if (type === 'expense') {
    color = theme.colors.expense;
    if (showSign && cents > 0) signPrefix = '-';
    if (showIcon) iconPrefix = '▼ ';
    accessibleLabel = `Expense: -${formatted}`;
  }

  return (
    <Text
      accessible={true}
      accessibilityLabel={accessibleLabel}
      style={[{ color, fontWeight: '700' }, style]}
    >
      {iconPrefix}
      {signPrefix}
      {formatted}
    </Text>
  );
};
