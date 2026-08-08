/** Shape check for a referenced entity id: a 24-character lowercase hex string (Mongo `ObjectId` format, as produced by the infrastructure layer). */
export const ID_PATTERN = '^[a-f0-9]{24}$';

/** Matches a `'YYYY-MM'` calendar month, e.g. `'2026-07'`. String form for LIVR's `like` rule. */
export const MONTH_PATTERN = '^\\d{4}-(0[1-9]|1[0-2])$';

/** Same pattern as {@link MONTH_PATTERN}, as a `RegExp` literal for direct `.test()` use. */
export const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Upper bound on any single money field, in integer minor units. Set well
 * above any plausible family-budget figure (1,000,000,000.00 in a 2-decimal
 * currency) while staying comfortably inside `Number.MAX_SAFE_INTEGER`, so
 * LIVR's `+value` coercion in `positive_integer`/`max_number` never loses
 * precision.
 */
export const MAX_MONEY_MINOR_UNITS = 1_000_000_000_00;

/** Upper bound on free-text name fields (category name). */
export const MAX_NAME_LENGTH = 120;

/** Upper bound on free-text description fields (transaction note). */
export const MAX_DESCRIPTION_LENGTH = 500;
