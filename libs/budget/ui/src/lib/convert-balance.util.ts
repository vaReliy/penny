import { Money } from 'shared-util';
import type { RateEntryDisplay } from './rate-entry-display';

/**
 * Splits a decimal string (e.g. `"41.5000"`) into an exact `numerator /
 * denominator` fraction — never parsed through `Number`/`parseFloat`, which
 * would reintroduce the binary-float precision loss the wire contract's
 * decimal-string shape exists to avoid.
 */
function toFraction(decimal: string): {
  numerator: bigint;
  denominator: bigint;
} {
  const [whole, fraction = ''] = decimal.split('.');
  return {
    numerator: BigInt(`${whole}${fraction}`),
    denominator: 10n ** BigInt(fraction.length),
  };
}

/** Rounds `numerator / denominator` to the nearest integer (half away from zero), entirely in `bigint`. */
function roundedDivide(numerator: bigint, denominator: bigint): bigint {
  const negative = numerator < 0n !== denominator < 0n;
  const absNumerator = numerator < 0n ? -numerator : numerator;
  const absDenominator = denominator < 0n ? -denominator : denominator;
  const rounded = (absNumerator + absDenominator / 2n) / absDenominator;
  return negative ? -rounded : rounded;
}

/**
 * Converts `balance` (in its own, base, currency) into the currency named by
 * `rate`, using `rate.rateToBase` (base-currency amount per one unit of
 * `rate.currency`). Both currencies use the same 2 minor-unit decimals in
 * this platform, so `balanceMinorUnits / rate` yields the target currency's
 * minor units directly — no major-unit round-trip needed. Entirely
 * `bigint` arithmetic: never converts through `Number`, so no float
 * precision loss enters a value that could be displayed or compared.
 */
export function convertBalanceToCurrency(
  balance: Money,
  rate: RateEntryDisplay,
): Money {
  const { numerator: rateNumerator, denominator: rateDenominator } = toFraction(
    rate.rateToBase,
  );
  const convertedMinorUnits = roundedDivide(
    balance.amount * rateDenominator,
    rateNumerator,
  );
  return Money.fromMinorUnits(convertedMinorUnits, rate.currency);
}
