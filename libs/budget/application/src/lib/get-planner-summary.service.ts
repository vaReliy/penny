import { BaseService } from 'shared-kernel';
import { Money } from 'shared-util';
import { PLANNER_SUMMARY_FILTER_SCHEMA } from 'budget-validation';
import type {
  IMonthlyBudgetRepository,
  ITransactionRepository,
} from 'budget-core';
import type { ServiceContext } from 'shared-kernel';

import { assertActiveCaller } from './assert-active-caller.js';
import { resolveMonthRange } from './resolve-month-range.js';
import type { BudgetServiceConfig } from './budget-service-config.js';

/** Input for {@link GetPlannerSummaryService}, matching `PLANNER_SUMMARY_FILTER_SCHEMA`. */
export interface GetPlannerSummaryParams {
  /** Calendar month to summarize, `'YYYY-MM'`. */
  readonly month: string;
}

/** Dependencies {@link GetPlannerSummaryService} needs, injected via its constructor. */
export interface GetPlannerSummaryDeps {
  readonly monthlyBudgetRepository: IMonthlyBudgetRepository;
  readonly transactionRepository: ITransactionRepository;
}

/**
 * Per-category rollup of budgeted vs. actual expense spending for one month.
 * Field names mirror the task-06 `PlannerCategorySummary` contract
 * (`categoryId`/`budgeted`/`spent`/`remaining`) exactly, plus `percent` — a
 * derived UI-progress value the legacy planner screen computed client-side
 * (`page-planner.component.ts#getProgressPercent`), absent from the task-06
 * DTO. Kept as an `application`-layer-only field on this result type (not
 * added to the `budget-contracts` DTO, which is a signed-off, already-tested
 * deliverable of a prior task) — a future controller task decides whether to
 * fold it into the wire response or recompute it in the presentation layer.
 */
export interface PlannerCategorySummaryResult {
  readonly categoryId: string;
  readonly budgeted: Money;
  readonly spent: Money;
  /** `budgeted - spent`; may be negative when overspent. */
  readonly remaining: Money;
  /**
   * `round(spent / budgeted * 100)`, floored at `0` and computed entirely in
   * `bigint` minor units (never a `number`/float division) until the final,
   * already-integral result is narrowed to `number` for the caller. `0` when
   * `budgeted` is zero (no budget set for this category this month) — never
   * `NaN`/`Infinity`.
   */
  readonly percent: number;
}

/** Result of {@link GetPlannerSummaryService}. */
export interface PlannerSummary {
  readonly month: string;
  readonly categories: readonly PlannerCategorySummaryResult[];
}

/**
 * Summarizes budgeted vs. actual expense spending, per category, for one
 * calendar month.
 *
 * Framework-free `application` service — no DI decorators. Union semantics
 * per the task-09 spec: a category appears in the result if it has a budget
 * for this month, actual expense spend this month, or both — a category
 * with spend but no budget shows `budgeted: 0`; a category with a budget but
 * no spend shows `spent: 0`. Both aggregations (`findByWorkspaceAndMonth`,
 * `sumExpenseByCategory`) are repository-pushed, never an in-memory reduce
 * over the full transaction set (D1) — this service only merges two already-
 * aggregated result sets and does the per-category subtraction/percent math.
 *
 * Month attribution: `params.month` is resolved once, up front, to a half-
 * open UTC instant range in Europe/Kyiv (`resolveMonthRange`, per the budget
 * domain model ADR) and passed to the repository as plain `Date` instants —
 * the repository/pipeline itself stays timezone-agnostic.
 */
export class GetPlannerSummaryService extends BaseService<
  GetPlannerSummaryParams,
  PlannerSummary
> {
  private readonly monthlyBudgetRepository: IMonthlyBudgetRepository;
  private readonly transactionRepository: ITransactionRepository;

  public constructor(deps: GetPlannerSummaryDeps) {
    super();
    this.monthlyBudgetRepository = deps.monthlyBudgetRepository;
    this.transactionRepository = deps.transactionRepository;
  }

  protected override getValidationSchema(): Record<string, unknown> {
    return PLANNER_SUMMARY_FILTER_SCHEMA;
  }

  protected override authorize(
    context: ServiceContext<BudgetServiceConfig>,
  ): void {
    assertActiveCaller(context);
  }

  protected override async execute(
    params: GetPlannerSummaryParams,
    context: ServiceContext<BudgetServiceConfig>,
  ): Promise<PlannerSummary> {
    const { workspaceId, defaultCurrency } = context.config;
    const range = resolveMonthRange(params.month);

    const [budgets, spendTotals] = await Promise.all([
      this.monthlyBudgetRepository.findByWorkspaceAndMonth(
        workspaceId,
        params.month,
      ),
      this.transactionRepository.sumExpenseByCategory(workspaceId, {
        from: range.from,
        to: range.to,
      }),
    ]);

    const budgetedByCategory = new Map(
      budgets.map((budget) => [budget.categoryId, budget.amount]),
    );
    const spentByCategory = new Map(
      spendTotals.map((total) => [
        total.categoryId,
        Money.fromMinorUnits(total.total, defaultCurrency),
      ]),
    );

    const categoryIds = new Set<string>([
      ...budgetedByCategory.keys(),
      ...spentByCategory.keys(),
    ]);

    const categories = [...categoryIds]
      .sort((a, b) => a.localeCompare(b))
      .map((categoryId) =>
        buildCategorySummary(
          categoryId,
          budgetedByCategory.get(categoryId) ?? Money.zero(defaultCurrency),
          spentByCategory.get(categoryId) ?? Money.zero(defaultCurrency),
        ),
      );

    return { month: params.month, categories };
  }
}

/** Builds one category's `PlannerCategorySummaryResult` from its resolved `budgeted`/`spent` `Money` values. */
function buildCategorySummary(
  categoryId: string,
  budgeted: Money,
  spent: Money,
): PlannerCategorySummaryResult {
  return {
    categoryId,
    budgeted,
    spent,
    remaining: budgeted.subtract(spent),
    percent: computePercent(spent, budgeted),
  };
}

/**
 * `round(spent / budgeted * 100)`, entirely in `bigint` minor units. Returns
 * `0` when `budgeted` is zero rather than dividing by zero.
 */
function computePercent(spent: Money, budgeted: Money): number {
  if (budgeted.isZero()) {
    return 0;
  }

  const HALF_FOR_ROUNDING = budgeted.amount / 2n;
  const roundedMinorUnitsPercent =
    (spent.amount * 100n + HALF_FOR_ROUNDING) / budgeted.amount;

  return Number(roundedMinorUnitsPercent);
}
