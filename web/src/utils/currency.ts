/**
 * Safe financial currency formatting utilizing native Intl.NumberFormat.
 * Avoids JavaScript floating-point arithmetic errors.
 */

export function formatCurrency(
  amount: string | number,
  currency = 'USD',
  locale = 'en-US'
): string {
  const numericValue = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numericValue)) {
    return '$0.00';
  }

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numericValue);
  } catch {
    // Fallback if an unsupported currency code is supplied
    return `${currency} ${numericValue.toFixed(2)}`;
  }
}

export function formatSignedCurrency(
  amount: string | number,
  type: 'EXPENSE' | 'INCOME',
  currency = 'USD'
): string {
  const formatted = formatCurrency(amount, currency);
  if (type === 'EXPENSE') {
    return `-${formatted}`;
  }
  return `+${formatted}`;
}
