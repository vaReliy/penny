import { Money } from 'shared-util';

/** Locale used for all budget money formatting — the only locale this app ships (see i18n rules). */
const DISPLAY_LOCALE = 'uk-UA';

/** Every currency this platform handles (UAH/USD/EUR) uses 2 minor-unit decimal digits. */
const MINOR_UNIT_DECIMALS = 2;

/**
 * Formats a `Money` value for on-screen display only — never for transport
 * or further arithmetic. Converts the exact `bigint` minor-unit amount to a
 * floating-point major-unit number solely to hand off to `Intl.NumberFormat`,
 * which is safe here because the result is a rendered string, not a value
 * that re-enters any calculation.
 */
export function formatMoney(money: Money): string {
  const majorUnits = Number(money.amount) / 10 ** MINOR_UNIT_DECIMALS;

  return new Intl.NumberFormat(DISPLAY_LOCALE, {
    style: 'currency',
    currency: money.currency,
    minimumFractionDigits: MINOR_UNIT_DECIMALS,
    maximumFractionDigits: MINOR_UNIT_DECIMALS,
  }).format(majorUnits);
}
