import {
  ID_PATTERN,
  MAX_MONEY_MINOR_UNITS,
  MONTH_PATTERN,
} from './patterns.js';

/** LIVR schema for `PUT /budget/monthly-budgets`. */
export const UPSERT_MONTHLY_BUDGET_SCHEMA: Record<string, unknown> = {
  categoryId: ['required', { like: ID_PATTERN }],
  month: ['required', { like: MONTH_PATTERN }],
  amountMinorUnits: [
    'required',
    'positive_integer',
    { max_number: MAX_MONEY_MINOR_UNITS },
  ],
};
