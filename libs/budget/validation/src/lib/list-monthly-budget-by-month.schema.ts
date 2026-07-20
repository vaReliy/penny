import { MONTH_PATTERN } from './patterns.js';

/** LIVR schema for `GET /budget/monthly-budgets` (query params). */
export const LIST_MONTHLY_BUDGET_BY_MONTH_SCHEMA: Record<string, unknown> = {
  month: ['required', { like: MONTH_PATTERN }],
};
