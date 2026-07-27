import type { SerializedMoney } from 'shared-util';

/**
 * Query params for `GET /budget/chart`. All fields are optional narrowing
 * filters; `from`/`to` and `month` are mutually exclusive ways to scope a
 * date range — callers pick one. An empty query returns an all-time total.
 */
export interface HistoryChartFilterQuery {
  /** Inclusive range start, `'YYYY-MM-DD'`. */
  readonly from?: string;
  /** Inclusive range end, `'YYYY-MM-DD'`. */
  readonly to?: string;
  /** Calendar month shorthand for the range, `'YYYY-MM'`. */
  readonly month?: string;
}

/** One category's expense total for the queried period. */
export interface HistoryChartEntryResponse {
  readonly categoryId: string;
  readonly name: string;
  readonly value: SerializedMoney;
}

/** Response body for `GET /budget/chart`. */
export type HistoryChartResponse = readonly HistoryChartEntryResponse[];
