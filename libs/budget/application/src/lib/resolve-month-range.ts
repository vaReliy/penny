/**
 * Timezone a `'YYYY-MM'` filter's wall-clock month boundary is resolved in.
 * Per the budget domain model ADR, month attribution (and therefore
 * month-range filtering) is computed in Europe/Kyiv, not UTC or server-local
 * time — the pipeline itself (repository queries) stays timezone-agnostic,
 * comparing stored UTC `date` instants against a range computed once here.
 */
const BUDGET_TIME_ZONE = 'Europe/Kyiv';

/** Half-open UTC instant range `[from, to)` covering one calendar month. */
export interface MonthRange {
  readonly from: Date;
  readonly to: Date;
}

/**
 * Resolves a `'YYYY-MM'` month string to the half-open UTC instant range
 * `[from, to)` spanning that calendar month's wall-clock boundaries in
 * `Europe/Kyiv` — correct across DST transitions, since each boundary is
 * resolved independently against the timezone's actual offset at that
 * instant (no fixed-offset assumption).
 *
 * @throws {Error} If `month` is not shaped `'YYYY-MM'`. Callers only ever
 * receive this from `TRANSACTION_FILTER_SCHEMA`-validated input, so this is
 * a defensive assertion, not a user-facing validation path.
 */
export function resolveMonthRange(month: string): MonthRange {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  if (!match) {
    throw new Error(`Expected a 'YYYY-MM' month string, received: ${month}`);
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;

  return {
    from: resolveMonthStartUtc(year, monthIndex),
    to: resolveMonthStartUtc(year, monthIndex + 1),
  };
}

/** Resolves 00:00:00 wall-clock time on the 1st of `year`/`monthIndex` (0-based, may overflow into the next year) in `BUDGET_TIME_ZONE`, to its UTC instant. */
function resolveMonthStartUtc(year: number, monthIndex: number): Date {
  // First guess: treat the target wall-clock time as if it were already UTC.
  const guess = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0));
  const offsetMinutes = resolveTimeZoneOffsetMinutes(guess, BUDGET_TIME_ZONE);

  // `guess` encodes the desired local wall time; subtracting the zone's
  // offset at that instant yields the actual UTC instant.
  return new Date(guess.getTime() - offsetMinutes * 60_000);
}

/** Minutes to add to a UTC timestamp to get `timeZone`'s local wall-clock time, at `date`. */
function resolveTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) {
    parts[part.type] = part.value;
  }

  const asUtc = Date.UTC(
    Number(parts['year']),
    Number(parts['month']) - 1,
    Number(parts['day']),
    Number(parts['hour']),
    Number(parts['minute']),
    Number(parts['second']),
  );

  return (asUtc - date.getTime()) / 60_000;
}
