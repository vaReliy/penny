import type {
  HistoryChartParams,
  ListTransactionsParams,
} from 'budget-data-access';

import type { HistoryFilterState } from './history-filter-state';
import { currentMonth, resolvePeriodRange } from './history-period.util';

interface DateScope {
  readonly from?: Date;
  readonly to?: Date;
  readonly month?: string;
}

function resolveDateScope(filter: HistoryFilterState, today: Date): DateScope {
  if (filter.period === undefined) {
    return {};
  }
  if (filter.period === 'month') {
    return { month: filter.month ?? currentMonth(today) };
  }
  const { from, to } = resolvePeriodRange(filter.period, today);
  return { from, to };
}

/**
 * Maps history filter state + "now" to `TransactionStore.load`'s params.
 *
 * Unlike the chart, the list endpoint mandates a period scope (it would
 * otherwise be an unbounded workspace scan), so a filter with no period
 * selected falls back to the current month rather than sending no scope.
 */
export function toListTransactionsParams(
  filter: HistoryFilterState,
  today: Date,
): ListTransactionsParams {
  const dateScope = resolveDateScope(filter, today);

  return {
    ...(filter.type !== undefined ? { type: filter.type } : {}),
    ...(filter.categoryId !== undefined
      ? { categoryId: filter.categoryId }
      : {}),
    ...(filter.period === undefined
      ? { month: currentMonth(today) }
      : dateScope),
  };
}

/**
 * Maps history filter state + "now" to `DashboardStore.loadChart`'s params.
 * `type`/`categoryId` don't apply — the chart endpoint is inherently an
 * outcome-by-category breakdown, so only the date scope carries over.
 */
export function toHistoryChartParams(
  filter: HistoryFilterState,
  today: Date,
): HistoryChartParams {
  return resolveDateScope(filter, today);
}
