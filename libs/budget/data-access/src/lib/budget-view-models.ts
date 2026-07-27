import type { Money, CurrencyCode } from 'shared-util';
import type { TransactionType } from 'budget-contracts';

/** UI-facing `Category`, with `archivedAt` as a `Date` instead of an ISO string. */
export interface CategoryView {
  readonly id: string;
  readonly name: string;
  readonly archivedAt?: Date;
}

/** UI-facing `MonthlyBudget`, with `amount` as a `Money` instead of `SerializedMoney`. */
export interface MonthlyBudgetView {
  readonly id: string;
  readonly categoryId: string;
  /** Calendar month this budget targets, `'YYYY-MM'`. */
  readonly month: string;
  readonly amount: Money;
}

/** UI-facing `Transaction`, with date/amount converted to `Date`/`Money`. */
export interface TransactionView {
  readonly id: string;
  readonly accountId: string;
  readonly categoryId: string;
  readonly type: TransactionType;
  readonly amount: Money;
  /** Economic date. */
  readonly date: Date;
  readonly description?: string;
  readonly createdBy: string;
  readonly createdAt: Date;
}

/** Params for `TransactionClient.record`, mirroring `CreateTransactionRequest` with `date` as a `Date`. */
export interface RecordTransactionParams {
  readonly accountId: string;
  readonly categoryId: string;
  readonly type: TransactionType;
  /** Always positive, in integer minor units — sign is conveyed by `type`. */
  readonly amountMinorUnits: number;
  readonly date: Date;
  readonly description?: string;
}

/** Params for `TransactionClient.list`, mirroring `TransactionFilterQuery` with date fields as `Date`. */
export interface ListTransactionsParams {
  readonly type?: TransactionType;
  readonly categoryId?: string;
  readonly accountId?: string;
  readonly from?: Date;
  readonly to?: Date;
  /** Calendar month shorthand for the range, `'YYYY-MM'`. */
  readonly month?: string;
}

/** UI-facing balance for one account. */
export interface BalanceView {
  readonly accountId: string;
  readonly balance: Money;
}

/** UI-facing per-category planner rollup, with amounts as `Money`. */
export interface PlannerCategorySummaryView {
  readonly categoryId: string;
  readonly budgeted: Money;
  readonly spent: Money;
  readonly remaining: Money;
}

/** UI-facing planner summary for one month. */
export interface PlannerSummaryView {
  readonly month: string;
  readonly categories: readonly PlannerCategorySummaryView[];
}

/** Params for `AnalyticsClient.getChart`, mirroring `HistoryChartFilterQuery` with date fields as `Date`. */
export interface HistoryChartParams {
  readonly from?: Date;
  readonly to?: Date;
  readonly month?: string;
}

/** UI-facing history chart entry, with `value` as a `Money`. */
export interface HistoryChartEntryView {
  readonly categoryId: string;
  readonly name: string;
  readonly value: Money;
}

/**
 * UI-facing exchange rate entry. `rateToBase` stays a decimal string — the
 * contract deliberately avoids float precision loss in transport, and this
 * view carries that guarantee through unchanged.
 */
export interface ExchangeRateEntryView {
  readonly currency: CurrencyCode;
  readonly rateToBase: string;
}

/** UI-facing exchange rates snapshot, with `asOf` as a `Date`. */
export interface ExchangeRatesView {
  readonly base: CurrencyCode;
  readonly rates: readonly ExchangeRateEntryView[];
  readonly asOf: Date;
}
