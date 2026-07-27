import type { CurrencyCode } from 'shared-util';

/**
 * One currency's rate relative to the balance's own (base) currency, as
 * needed for display. Deliberately a local, structurally-typed shape rather
 * than an import of `budget-data-access`'s `ExchangeRateEntryView` — a
 * `type:ui` lib may only depend on `type:ui`/`type:util`. Callers in
 * `budget-feature-account` (a `type:feature` lib, which may import
 * `type:data`) can pass an `ExchangeRateEntryView[]` here unchanged; the two
 * shapes match field-for-field.
 */
export interface RateEntryDisplay {
  readonly currency: CurrencyCode;
  /** Decimal string, e.g. `"41.5000"` — amount of the base currency per one unit of `currency`. */
  readonly rateToBase: string;
}
