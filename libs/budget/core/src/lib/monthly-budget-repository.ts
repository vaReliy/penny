import type { IRepository } from 'shared-kernel';
import type { Money } from 'shared-util';

import type { MonthlyBudget } from './monthly-budget.js';

/**
 * Data access contract for {@link MonthlyBudget} aggregates. Extends the
 * kernel's generic {@link IRepository} (`findById`/`save`/`delete`) with
 * workspace-scoped lookups. Every finder takes `workspaceId`.
 */
export interface IMonthlyBudgetRepository extends IRepository<
  MonthlyBudget,
  string
> {
  /** Finds all budgets for `workspaceId` in the given `'YYYY-MM'` month. */
  findByWorkspaceAndMonth(
    workspaceId: string,
    month: string,
  ): Promise<MonthlyBudget[]>;

  /**
   * Finds the single budget for `(workspaceId, categoryId, month)`, or
   * `null` if none exists.
   */
  findByWorkspaceCategoryMonth(
    workspaceId: string,
    categoryId: string,
    month: string,
  ): Promise<MonthlyBudget | null>;

  /**
   * Creates or replaces the budget amount for `(workspaceId, categoryId,
   * month)` — at most one budget exists per category per month.
   */
  upsertAmount(
    workspaceId: string,
    categoryId: string,
    month: string,
    amount: Money,
  ): Promise<void>;
}
