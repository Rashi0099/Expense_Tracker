import { describe, it, expect } from 'vitest';
import { formatCurrency, formatSignedCurrency } from '@/utils/currency';

describe('Financial Currency Formatting', () => {
  it('formats standard positive numbers correctly', () => {
    const formatted = formatCurrency(1250.5, 'USD');
    expect(formatted).toBe('$1,250.50');
  });

  it('formats string amounts without floating point drift', () => {
    const formatted = formatCurrency('99.99', 'USD');
    expect(formatted).toBe('$99.99');
  });

  it('formats signed currencies for expenses and income', () => {
    const exp = formatSignedCurrency('45.00', 'EXPENSE', 'USD');
    const inc = formatSignedCurrency('5000.00', 'INCOME', 'USD');

    expect(exp).toBe('-$45.00');
    expect(inc).toBe('+$5,000.00');
  });

  it('safely handles zero and invalid amounts', () => {
    expect(formatCurrency(0, 'USD')).toBe('$0.00');
    expect(formatCurrency('invalid', 'USD')).toBe('$0.00');
  });
});
