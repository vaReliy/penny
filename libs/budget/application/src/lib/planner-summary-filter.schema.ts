import { MONTH_PATTERN } from 'shared-util';

/** LIVR schema for `GET /budget/planner/summary` (query params). */
export const PLANNER_SUMMARY_FILTER_SCHEMA: Record<string, unknown> = {
  month: ['required', { like: MONTH_PATTERN }],
};
