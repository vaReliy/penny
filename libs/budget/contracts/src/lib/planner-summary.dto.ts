import type { SerializedMoney } from 'shared-util';

/** Query params for `GET /budget/planner/summary`. */
export interface PlannerSummaryFilterQuery {
  /** Calendar month to summarize, `'YYYY-MM'`. */
  readonly month: string;
}

/** Per-category rollup of budgeted vs. actual expense spending for one month. */
export interface PlannerCategorySummary {
  readonly categoryId: string;
  readonly budgeted: SerializedMoney;
  readonly spent: SerializedMoney;
  /** `budgeted - spent`; may be negative when overspent. */
  readonly remaining: SerializedMoney;
}

/** Response body for `GET /budget/planner/summary`. */
export interface PlannerSummaryResponse {
  readonly month: string;
  readonly categories: readonly PlannerCategorySummary[];
}
