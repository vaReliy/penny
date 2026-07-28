import type { HistoryPeriod } from './history-filter-state';

/** Inclusive `[from, to]` date range, both `Date`s representing UTC midnight of a calendar day. */
export interface DateRange {
  readonly from: Date;
  readonly to: Date;
}

const DAYS_IN_WEEK = 7;
const ISO_SUNDAY = 7;

/**
 * A UTC-midnight instant for the given local calendar day — matches the
 * contract `budget-data-access`'s `toIsoDateOnly` expects (a `Date` whose
 * `.toISOString()` date component IS the intended calendar day). `Date.UTC`
 * normalizes an out-of-range `day` (e.g. `0` or negative), so this rolls
 * across month/year boundaries correctly.
 */
function toUtcMidnight(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

/** Resolves the `day`/`week` period presets to a date range anchored on `today`'s local calendar date. */
export function resolvePeriodRange(
  period: Exclude<HistoryPeriod, 'month'>,
  today: Date,
): DateRange {
  const year = today.getFullYear();
  const month = today.getMonth();
  const day = today.getDate();

  if (period === 'day') {
    const boundary = toUtcMidnight(year, month, day);
    return { from: boundary, to: boundary };
  }

  const isoWeekday = today.getDay() === 0 ? ISO_SUNDAY : today.getDay();
  const mondayDay = day - (isoWeekday - 1);
  const from = toUtcMidnight(year, month, mondayDay);
  const to = toUtcMidnight(year, month, mondayDay + DAYS_IN_WEEK - 1);
  return { from, to };
}

/** `today`'s calendar month as `'YYYY-MM'`, in local time. */
export function currentMonth(today: Date): string {
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
}
