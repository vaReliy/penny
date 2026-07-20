/**
 * Shape check for a referenced entity id (Mongo `ObjectId` hex string, as
 * produced by the infrastructure layer). Used via the LIVR `like` rule,
 * which rejects non-primitive input before pattern-matching — this is what
 * closes the Mongo-operator-injection surface (`{ $gt: '' }`-style objects)
 * on every id-shaped field.
 */
export const ID_PATTERN = '^[a-f0-9]{24}$';

/** Matches a `'YYYY-MM'` calendar month, e.g. `'2026-07'`. */
export const MONTH_PATTERN = '^\\d{4}-(0[1-9]|1[0-2])$';

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
