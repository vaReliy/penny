import {
  ID_PATTERN,
  MAX_DESCRIPTION_LENGTH,
  MAX_MONEY_MINOR_UNITS,
} from 'shared-util';

/** LIVR schema for `POST /budget/transactions`. */
export const CREATE_TRANSACTION_SCHEMA: Record<string, unknown> = {
  // `like: ID_PATTERN` (also used at every other id-shaped field across this
  // lib's schemas) matters beyond format-checking: LIVR's `like` rule rejects
  // non-primitive input before pattern-matching, which is what closes the
  // Mongo-operator-injection surface (`{ $gt: '' }`-style objects) on any
  // field ultimately used in a Mongo query.
  accountId: ['required', { like: ID_PATTERN }],
  categoryId: ['required', { like: ID_PATTERN }],
  type: ['required', { one_of: ['income', 'expense'] }],
  amountMinorUnits: [
    'required',
    'positive_integer',
    { max_number: MAX_MONEY_MINOR_UNITS },
  ],
  date: ['required', 'iso_date'],
  description: ['string', { max_length: MAX_DESCRIPTION_LENGTH }],
};
