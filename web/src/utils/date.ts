import { DateFilterPreset } from '@/types/analytics';

export function formatDate(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function getTodayDateString(): string {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

export function getCurrentMonthString(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function getShiftedMonthString(monthStr: string, offset: number): string {
  const [yearStr, mStr] = monthStr.split('-');
  const date = new Date(parseInt(yearStr, 10), parseInt(mStr, 10) - 1 + offset, 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function formatMonthLabel(monthStr: string): string {
  const [yearStr, mStr] = monthStr.split('-');
  const date = new Date(parseInt(yearStr, 10), parseInt(mStr, 10) - 1, 1);
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
}

export function getDateRangeForPreset(preset: DateFilterPreset): { startDate: string; endDate: string } {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const toIso = (d: Date) => d.toISOString().split('T')[0];

  switch (preset) {
    case 'THIS_MONTH': {
      const start = new Date(currentYear, currentMonth, 1);
      const end = new Date(currentYear, currentMonth + 1, 0);
      return { startDate: toIso(start), endDate: toIso(end) };
    }
    case 'LAST_MONTH': {
      const start = new Date(currentYear, currentMonth - 1, 1);
      const end = new Date(currentYear, currentMonth, 0);
      return { startDate: toIso(start), endDate: toIso(end) };
    }
    case 'LAST_3_MONTHS': {
      const start = new Date(currentYear, currentMonth - 2, 1);
      const end = new Date(currentYear, currentMonth + 1, 0);
      return { startDate: toIso(start), endDate: toIso(end) };
    }
    case 'THIS_YEAR': {
      const start = new Date(currentYear, 0, 1);
      const end = new Date(currentYear, 11, 31);
      return { startDate: toIso(start), endDate: toIso(end) };
    }
    case 'CUSTOM':
    default: {
      const start = new Date(currentYear, currentMonth, 1);
      const end = new Date(currentYear, currentMonth + 1, 0);
      return { startDate: toIso(start), endDate: toIso(end) };
    }
  }
}
