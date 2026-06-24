import type { CurrencyCode } from './currency-code.js';

/**
 * Serialized, transport-safe shape of a `Money` value.
 * `amount` is the integer minor-unit amount encoded as a string so it
 * survives JSON round-trips without precision loss for very large values.
 */
export interface SerializedMoney {
  readonly amount: string;
  readonly currency: CurrencyCode;
}
