/** Length of the date-only prefix of an ISO date-time string, e.g. `'2026-07-27'`. */
const ISO_DATE_ONLY_LENGTH = 10;

/**
 * Converts a calendar `Date` to the `'YYYY-MM-DD'` string the
 * transaction/chart contracts expect. Extracts the date via `.toISOString()`
 * (UTC), so `date` must represent a UTC instant at the intended calendar
 * day's midnight — a local-midnight `Date` (e.g. `new Date(year, month,
 * day)`) shifts by a day under Kyiv's UTC+2/+3 offset.
 */
export function toIsoDateOnly(date: Date): string {
  return date.toISOString().slice(0, ISO_DATE_ONLY_LENGTH);
}

/**
 * Parses an ISO date-only (`'YYYY-MM-DD'`) or date-time string into a `Date`.
 * A date-only input is interpreted as UTC midnight (per the `Date`
 * constructor's ISO 8601 parsing rule) — the returned `Date` represents a
 * UTC instant, not local wall-clock time.
 */
export function fromIsoDate(value: string): Date {
  return new Date(value);
}
