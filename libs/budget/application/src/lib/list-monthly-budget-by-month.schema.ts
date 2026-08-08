import { MONTH_PATTERN } from 'shared-util';

/** LIVR schema for `GET /budget/monthly-budgets` (query params). */
export const LIST_MONTHLY_BUDGET_BY_MONTH_SCHEMA: Record<string, unknown> = {
  month: ['required', { like: MONTH_PATTERN }],
};
