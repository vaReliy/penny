/**
 * ISO 4217 three-letter currency code (e.g. `USD`, `EUR`, `UAH`).
 * Kept as a plain string type — validating against the full ISO list is
 * out of scope for this leaf utility lib.
 */
export type CurrencyCode = string;
