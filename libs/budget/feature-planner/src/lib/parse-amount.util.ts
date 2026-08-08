import { MAX_MONEY_MINOR_UNITS } from 'shared-util';

// Canonical copy of this whole util also lives in `budget-feature-records`
// (`type:feature` libs don't export/share utils across each other).

/** Matches an amount typed with either `,` or `.` as the decimal separator, up to 2 fraction digits. */
const AMOUNT_PATTERN = /^(\d+)(?:[.,](\d{1,2}))?$/;

/**
 * Parses a hryvnia amount typed by the user (e.g. `"123,45"` or `"123.4"`)
 * into an integer count of kopiykas. Never routes the value through
 * `parseFloat`/`Number` on the combined string — whole and fraction parts
 * are parsed as integers independently, then combined with integer
 * multiplication/addition, so no float rounding ever touches the amount.
 * Returns `null` for empty, malformed, non-positive, or out-of-range input.
 */
export function parseAmountToMinorUnits(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const match = AMOUNT_PATTERN.exec(trimmed);
  if (!match) {
    return null;
  }

  const [, wholePart, fractionPart = ''] = match;
  const paddedFraction = fractionPart.padEnd(2, '0');
  const minorUnits = Number(wholePart) * 100 + Number(paddedFraction);

  if (minorUnits <= 0 || minorUnits > MAX_MONEY_MINOR_UNITS) {
    return null;
  }

  return minorUnits;
}
