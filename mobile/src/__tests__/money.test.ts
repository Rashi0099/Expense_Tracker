import { describe, it, expect } from 'vitest';
import {
  dollarsToCents,
  centsToDollars,
  formatCurrencyFromCents,
} from '../utils/money';

describe('Financial Precision & Minor Units (Cents) Strategy', () => {
  it('converts decimal strings to integer cents accurately', () => {
    expect(dollarsToCents('10.50')).toBe(1050);
    expect(dollarsToCents('0.99')).toBe(99);
    expect(dollarsToCents('0.05')).toBe(5);
    expect(dollarsToCents('100')).toBe(10000);
    expect(dollarsToCents('1234.56')).toBe(123456);
    expect(dollarsToCents('10.5')).toBe(1050);
    expect(dollarsToCents('0')).toBe(0);
    expect(dollarsToCents('')).toBe(0);
  });

  it('converts numbers to integer cents without floating point drift', () => {
    expect(dollarsToCents(10.5)).toBe(1050);
    expect(dollarsToCents(19.99)).toBe(1999);
    expect(dollarsToCents(0.1 + 0.2)).toBe(30); // Classic IEEE 754 float drift prevention!
  });

  it('converts integer cents back to exact decimal strings', () => {
    expect(centsToDollars(1050)).toBe('10.50');
    expect(centsToDollars(99)).toBe('0.99');
    expect(centsToDollars(5)).toBe('0.05');
    expect(centsToDollars(10000)).toBe('100.00');
    expect(centsToDollars(0)).toBe('0.00');
    expect(centsToDollars(-250)).toBe('-2.50');
  });

  it('formats currency for display with correct symbol', () => {
    expect(formatCurrencyFromCents(1050, 'USD')).toBe('$10.50');
    expect(formatCurrencyFromCents(100000, 'USD')).toBe('$1,000.00');
    expect(formatCurrencyFromCents(500000, 'INR')).toBe('₹5,000.00');
    expect(formatCurrencyFromCents(2500, 'EUR')).toBe('€25.00');
    expect(formatCurrencyFromCents(-1500, 'USD')).toBe('-$15.00');
  });
});
