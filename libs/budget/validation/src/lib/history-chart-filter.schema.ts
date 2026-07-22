import { MONTH_PATTERN } from './patterns.js';

/**
 * LIVR schema for `GET /budget/history/chart` (query params — all optional).
 * `month` and `from`/`to` are mutually exclusive at the application-service
 * layer (`GetPlannerSummaryService`'s sibling, `GetHistoryChartService`,
 * resolves `month` to a range and lets it win when both are supplied) — LIVR
 * cannot express that cross-field precedence, so it is not attempted here.
 */
export const HISTORY_CHART_FILTER_SCHEMA: Record<string, unknown> = {
  from: ['iso_date'],
  to: ['iso_date'],
  month: [{ like: MONTH_PATTERN }],
};
