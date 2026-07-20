import type { SerializedMoney } from 'shared-util';

/** Request body for `PUT /budget/monthly-budgets`. Creates or replaces the ceiling for one category/month. */
export interface UpsertMonthlyBudgetRequest {
  readonly categoryId: string;
  /** Calendar month this budget targets, `'YYYY-MM'`. */
  readonly month: string;
  /** Ceiling target for expense spending, in integer minor units. */
  readonly amountMinorUnits: number;
}

/** Query params for `GET /budget/monthly-budgets`. */
export interface ListMonthlyBudgetByMonthQuery {
  /** Calendar month to list budgets for, `'YYYY-MM'`. */
  readonly month: string;
}

/** Response shape for a single monthly budget. */
export interface MonthlyBudgetResponse {
  readonly id: string;
  readonly categoryId: string;
  readonly month: string;
  readonly amount: SerializedMoney;
}

/** Response body for `GET /budget/monthly-budgets`. */
export type MonthlyBudgetListResponse = readonly MonthlyBudgetResponse[];
