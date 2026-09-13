/**
 * Timestamp & Calendar Date Utilities (Section 25 & 41)
 *
 * Enforces consistent UTC ISO-8601 timestamps for syncable entities while
 * strictly preserving YYYY-MM-DD calendar date semantics across timezone boundaries.
 */

/**
 * Returns current UTC timestamp in ISO-8601 format ('YYYY-MM-DDTHH:mm:ss.sssZ').
 */
export function getUTCTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Returns today's local date formatted as 'YYYY-MM-DD'.
 */
export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats a 'YYYY-MM-DD' date string for human reading (e.g. "Sep 13, 2026").
 */
export function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  const date = new Date(year, month, day);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Returns the current month in 'YYYY-MM' format.
 */
export function getCurrentMonthString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Returns yesterday's local date formatted as 'YYYY-MM-DD'.
 */
export function getYesterdayDateString(referenceDateStr: string = getTodayDateString()): string {
  const parts = referenceDateStr.split('-').map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  date.setDate(date.getDate() - 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats a calendar date relative to today: "Today", "Yesterday", or formatted date.
 * Strictly avoids UTC timezone shift by comparing calendar day strings.
 */
export function formatRelativeDate(
  dateStr: string,
  referenceToday: string = getTodayDateString()
): string {
  if (!dateStr) return '';
  if (dateStr === referenceToday) return 'Today';
  if (dateStr === getYesterdayDateString(referenceToday)) return 'Yesterday';
  return formatDisplayDate(dateStr);
}

/**
 * Formats 'YYYY-MM' into human-friendly Month & Year (e.g. "September 2026").
 */
export function formatMonthYear(monthStr: string): string {
  if (!monthStr) return '';
  const parts = monthStr.split('-');
  if (parts.length < 2) return monthStr;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const date = new Date(year, month, 1);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}
