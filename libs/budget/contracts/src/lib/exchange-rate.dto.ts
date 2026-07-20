import type { CurrencyCode } from 'shared-util';

/** One currency's rate relative to `ExchangeRatesResponse.base`. */
export interface ExchangeRateEntry {
  readonly currency: CurrencyCode;
  /** Decimal string, e.g. `"1.0842"` — kept as a string to avoid float precision loss in transport. */
  readonly rateToBase: string;
}

/** Response body for `GET /budget/exchange-rates`. */
export interface ExchangeRatesResponse {
  readonly base: CurrencyCode;
  readonly rates: readonly ExchangeRateEntry[];
  /** ISO date-time string for when the rates were fetched/computed. */
  readonly asOf: string;
}
