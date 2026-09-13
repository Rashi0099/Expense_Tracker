export const APP_CONSTANTS = {
  MIN_TOUCH_TARGET_SIZE: 48,
  DEFAULT_PAGE_SIZE: 20,
  FAST_CAPTURE_TIMEOUT_SECONDS: 5,
  MAX_RETRY_COUNT: 5,
} as const;

export const PAYMENT_METHODS = [
  { label: 'Debit Card', value: 'DEBIT_CARD' },
  { label: 'Credit Card', value: 'CREDIT_CARD' },
  { label: 'UPI', value: 'UPI' },
  { label: 'Cash', value: 'CASH' },
  { label: 'Bank Transfer', value: 'BANK_TRANSFER' },
  { label: 'Other', value: 'OTHER' },
] as const;

export const RECURRING_FREQUENCIES = [
  { label: 'Daily', value: 'DAILY' },
  { label: 'Weekly', value: 'WEEKLY' },
  { label: 'Monthly', value: 'MONTHLY' },
  { label: 'Yearly', value: 'YEARLY' },
] as const;
