/**
 * Financial Precision Utilities — Minor Units (Cents) Strategy
 *
 * To eliminate all IEEE 754 floating-point rounding errors, all financial
 * quantities in the local SQLite database and domain layer are manipulated
 * as exact integer cents (Minor Units).
 *
 * Examples:
 *   $10.50 ➔ 1050 cents
 *   $0.05  ➔ 5 cents
 *   $100   ➔ 10000 cents
 */

/**
 * Converts a decimal string (e.g. "10.50") into integer cents (1050).
 */
export function dollarsToCents(amount: string | number): number {
  if (typeof amount === 'number') {
    amount = amount.toFixed(2);
  }

  const clean = amount.trim();
  if (!clean) return 0;

  const isNegative = clean.startsWith('-');
  const unsigned = isNegative ? clean.slice(1) : clean;

  const parts = unsigned.split('.');
  const whole = parseInt(parts[0] || '0', 10);
  let fraction = parts[1] || '00';

  if (fraction.length === 1) {
    fraction += '0';
  } else if (fraction.length > 2) {
    fraction = fraction.slice(0, 2);
  }

  const cents = whole * 100 + parseInt(fraction, 10);
  return isNegative ? -cents : cents;
}

/**
 * Converts integer cents (1050) into standard decimal string ("10.50").
 */
export function centsToDollars(cents: number): string {
  const isNegative = cents < 0;
  const absCents = Math.abs(cents);
  const whole = Math.floor(absCents / 100);
  const fraction = absCents % 100;
  const fractionStr = fraction < 10 ? `0${fraction}` : `${fraction}`;
  return `${isNegative ? '-' : ''}${whole}.${fractionStr}`;
}

/**
 * Formats integer cents for display with standard ISO currency symbols.
 */
export function formatCurrencyFromCents(
  cents: number,
  currency = 'USD'
): string {
  const dollars = centsToDollars(cents);
  const symbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    INR: '₹',
    CAD: 'CA$',
    AUD: 'A$',
    JPY: '¥',
  };

  const symbol = symbols[currency.toUpperCase()] || `${currency} `;
  const isNegative = dollars.startsWith('-');
  const absDollars = isNegative ? dollars.slice(1) : dollars;

  const parts = absDollars.split('.');
  const withCommas = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const formatted = `${withCommas}.${parts[1]}`;

  return `${isNegative ? '-' : ''}${symbol}${formatted}`;
}
