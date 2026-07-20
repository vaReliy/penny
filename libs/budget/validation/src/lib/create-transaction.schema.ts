import {
  ID_PATTERN,
  MAX_DESCRIPTION_LENGTH,
  MAX_MONEY_MINOR_UNITS,
} from './patterns.js';

/** LIVR schema for `POST /budget/transactions`. */
export const CREATE_TRANSACTION_SCHEMA: Record<string, unknown> = {
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
