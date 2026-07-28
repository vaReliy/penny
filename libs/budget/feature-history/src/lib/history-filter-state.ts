import type { TransactionType } from 'budget-data-access';

/** Period preset for narrowing the history list/chart by date. */
export type HistoryPeriod = 'day' | 'week' | 'month';

/** Filter state for the history screen, round-tripped through route query params. */
export interface HistoryFilterState {
  readonly type?: TransactionType;
  readonly categoryId?: string;
  readonly period?: HistoryPeriod;
  /** Only meaningful when `period === 'month'`, `'YYYY-MM'`. */
  readonly month?: string;
}

const VALID_TYPES: readonly string[] = ['income', 'expense'];
const VALID_PERIODS: readonly string[] = ['day', 'week', 'month'];

function isTransactionType(value: string): value is TransactionType {
  return VALID_TYPES.includes(value);
}

function isHistoryPeriod(value: string): value is HistoryPeriod {
  return VALID_PERIODS.includes(value);
}

/** Parses filter state from route query params. Unrecognized/invalid values are dropped silently, never thrown. */
export function parseHistoryFilter(
  params: Readonly<Record<string, string | undefined>>,
): HistoryFilterState {
  const type = params['type'];
  const categoryId = params['categoryId'];
  const period = params['period'];
  const month = params['month'];

  return {
    ...(type !== undefined && isTransactionType(type) ? { type } : {}),
    ...(categoryId !== undefined && categoryId.length > 0
      ? { categoryId }
      : {}),
    ...(period !== undefined && isHistoryPeriod(period) ? { period } : {}),
    ...(month !== undefined && month.length > 0 ? { month } : {}),
  };
}

/**
 * Serializes filter state to route query params. Fields that don't apply
 * (e.g. `month` when `period` isn't `'month'`) are `undefined`, not empty
 * strings — the Angular router omits `undefined` params from the URL.
 */
export function toHistoryQueryParams(
  filter: HistoryFilterState,
): Record<string, string | undefined> {
  return {
    type: filter.type,
    categoryId: filter.categoryId,
    period: filter.period,
    month: filter.period === 'month' ? filter.month : undefined,
  };
}

/** True when no narrowing filter is active — used to pick between the two empty-state messages. */
export function isHistoryFilterEmpty(filter: HistoryFilterState): boolean {
  return (
    filter.type === undefined &&
    filter.categoryId === undefined &&
    filter.period === undefined
  );
}
