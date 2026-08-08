import { ID_PATTERN, MONTH_PATTERN } from 'shared-util';

/** LIVR schema for `GET /budget/transactions` (query params — all optional). */
export const TRANSACTION_FILTER_SCHEMA: Record<string, unknown> = {
  type: [{ one_of: ['income', 'expense'] }],
  categoryId: [{ like: ID_PATTERN }],
  accountId: [{ like: ID_PATTERN }],
  from: ['iso_date'],
  to: ['iso_date'],
  month: [{ like: MONTH_PATTERN }],
};
