import { Money } from 'shared-util';
import type { CurrencyCode } from 'shared-util';
import type { CategoryView, PlannerSummaryView } from 'budget-data-access';

import { resolveProgressDisplay } from './planner-progress.util';
import type { PlannerProgressStatus } from './planner-progress.util';

/**
 * MVP is single-currency; only used to seed a zero `Money` for a category
 * absent from the month's summary (neither budgeted nor spent), so its
 * actual value never surfaces in a rendered amount.
 */
export const FALLBACK_CURRENCY: CurrencyCode = 'UAH';

/** One planner row: an active category joined against its month summary (or zeroed, if absent). */
export interface PlannerRowViewModel {
  readonly categoryId: string;
  readonly categoryName: string;
  readonly budgeted: Money;
  readonly spent: Money;
  readonly remaining: Money;
  readonly percent: number;
  readonly status: PlannerProgressStatus;
}

/**
 * Builds one row per active (non-archived) category for the given month.
 * Left-joins the category list against `PlannerSummaryView.categories` — a
 * superset of the backend's budget-or-spend union (a category with neither
 * still gets a zeroed row so it can have its first budget set from here).
 * A category present in the summary but budgeted `0`/spent `0` and one
 * absent from the summary entirely render identically, by construction.
 */
export function buildPlannerRows(
  categories: readonly CategoryView[],
  summary: PlannerSummaryView | null,
): readonly PlannerRowViewModel[] {
  const summaryByCategory = new Map(
    (summary?.categories ?? []).map((category) => [
      category.categoryId,
      category,
    ]),
  );
  const currency =
    summary?.categories[0]?.budgeted.currency ?? FALLBACK_CURRENCY;

  return categories
    .filter((category) => category.archivedAt === undefined)
    .map((category) => {
      const found = summaryByCategory.get(category.id);
      const budgeted = found?.budgeted ?? Money.zero(currency);
      const spent = found?.spent ?? Money.zero(currency);
      const remaining = found?.remaining ?? budgeted.subtract(spent);
      const { percent, status } = resolveProgressDisplay(
        spent.amount,
        budgeted.amount,
      );

      return {
        categoryId: category.id,
        categoryName: category.name,
        budgeted,
        spent,
        remaining,
        percent,
        status,
      };
    });
}

/** Sums a list of `Money` values sharing one currency. `fallbackCurrency` seeds the zero accumulator when `values` is empty. */
export function sumMoney(
  values: readonly Money[],
  fallbackCurrency: CurrencyCode,
): Money {
  return values.reduce(
    (total, value) => total.add(value),
    Money.zero(values[0]?.currency ?? fallbackCurrency),
  );
}

/** True when every row has both a zero budget and zero spend for the month — the empty-month state. */
export function isPlannerMonthEmpty(
  rows: readonly PlannerRowViewModel[],
): boolean {
  return rows.every((row) => row.budgeted.isZero() && row.spent.isZero());
}
