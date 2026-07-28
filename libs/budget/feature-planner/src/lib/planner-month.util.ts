const MONTH_LABEL_LOCALE = 'uk-UA';
const MONTHS_IN_YEAR = 12;

/**
 * `today`'s calendar month as `'YYYY-MM'`, in local time. Mirrors
 * `feature-history`'s `currentMonth` util — not re-exported/shared across
 * feature libs (see `code-style-angular.md`'s `type:feature` duplication
 * precedent), so this is a deliberate, independent restatement.
 */
export function currentMonth(today: Date): string {
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
}

/** Shifts a `'YYYY-MM'` month string by `deltaMonths` (may be negative), rolling across year boundaries. */
export function shiftMonth(month: string, deltaMonths: number): string {
  const [yearPart, monthPart] = month.split('-');
  const year = Number(yearPart);
  const zeroBasedMonth = Number(monthPart) - 1;
  const shiftedIndex = zeroBasedMonth + deltaMonths;
  const shiftedYear = year + Math.floor(shiftedIndex / MONTHS_IN_YEAR);
  const shiftedMonth =
    ((shiftedIndex % MONTHS_IN_YEAR) + MONTHS_IN_YEAR) % MONTHS_IN_YEAR;
  return `${shiftedYear}-${String(shiftedMonth + 1).padStart(2, '0')}`;
}

/** Formats a `'YYYY-MM'` month string as a localized "Month Year" label, e.g. `'липень 2026'`. */
export function formatMonthLabel(month: string): string {
  const [yearPart, monthPart] = month.split('-');
  const date = new Date(Date.UTC(Number(yearPart), Number(monthPart) - 1, 1));
  return new Intl.DateTimeFormat(MONTH_LABEL_LOCALE, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}
