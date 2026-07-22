import { BaseService } from 'shared-kernel';
import { Money } from 'shared-util';
import { HISTORY_CHART_FILTER_SCHEMA } from 'budget-validation';
import type { ICategoryRepository, ITransactionRepository } from 'budget-core';
import type { ServiceContext } from 'shared-kernel';

import { assertActiveCaller } from './assert-active-caller.js';
import { resolveMonthRange } from './resolve-month-range.js';
import type { BudgetServiceConfig } from './budget-service-config.js';

/** Fallback label when a summed `categoryId` cannot be resolved to a `Category` (should not occur — see `execute`). */
const UNKNOWN_CATEGORY_NAME = 'Unknown category';

/** Input for {@link GetHistoryChartService}, matching `HISTORY_CHART_FILTER_SCHEMA`. All fields are optional narrowing filters. */
export interface GetHistoryChartParams {
  /** Inclusive range start, `'YYYY-MM-DD'`. Mutually exclusive with `month`. */
  readonly from?: string;
  /** Inclusive range end, `'YYYY-MM-DD'`. Mutually exclusive with `month`. */
  readonly to?: string;
  /** Calendar month shorthand for the range, `'YYYY-MM'`. Mutually exclusive with `from`/`to`. */
  readonly month?: string;
}

/** Dependencies {@link GetHistoryChartService} needs, injected via its constructor. */
export interface GetHistoryChartDeps {
  readonly transactionRepository: ITransactionRepository;
  readonly categoryRepository: ICategoryRepository;
}

/**
 * One category's expense total for the queried period — the new-contract
 * shape of the legacy pie-chart's `IChartData { name, value }`, keyed by
 * `categoryId` (name alone was never unique-safe) in addition to `name`.
 */
export interface HistoryChartEntry {
  readonly categoryId: string;
  readonly name: string;
  readonly value: Money;
}

/**
 * Builds category-grouped expense totals for the "history" pie chart,
 * optionally narrowed to a period (`month`, or an explicit `from`/`to`
 * range — `month` wins if both are given, mirroring `ListTransactionsService`
 * and `GetPlannerSummaryService`). Unlike `ListTransactionsService`, a
 * period is not mandatory here: every call is answered by a single
 * repository aggregation (`sumExpenseByCategory`), never an in-memory scan
 * of the transaction set, so an unbounded (all-time) chart is a legitimate,
 * D1-compliant query — not the unbounded-`findByWorkspace` foot-gun
 * `ListTransactionsService` guards against.
 *
 * Framework-free `application` service — no DI decorators. Category names
 * are resolved via a bounded `ICategoryRepository.findByWorkspace` lookup
 * (bounded by the workspace's category count, not its transaction count —
 * not the fetch-all-and-reduce pattern D1 forbids, since the aggregation
 * itself is still repository-pushed) and joined onto the repo's
 * `{categoryId, total}` aggregation result; archived categories are
 * included (`includeArchived: true`) because `sumExpenseByCategory` itself
 * includes archived-category spend per the ADR, so name resolution must
 * cover the same set or an archived category's slice would render
 * nameless.
 */
export class GetHistoryChartService extends BaseService<
  GetHistoryChartParams,
  readonly HistoryChartEntry[]
> {
  private readonly transactionRepository: ITransactionRepository;
  private readonly categoryRepository: ICategoryRepository;

  public constructor(deps: GetHistoryChartDeps) {
    super();
    this.transactionRepository = deps.transactionRepository;
    this.categoryRepository = deps.categoryRepository;
  }

  protected override getValidationSchema(): Record<string, unknown> {
    return HISTORY_CHART_FILTER_SCHEMA;
  }

  protected override authorize(
    context: ServiceContext<BudgetServiceConfig>,
  ): void {
    assertActiveCaller(context);
  }

  protected override async execute(
    params: GetHistoryChartParams,
    context: ServiceContext<BudgetServiceConfig>,
  ): Promise<readonly HistoryChartEntry[]> {
    const { workspaceId, defaultCurrency } = context.config;

    const range = params.month
      ? resolveMonthRange(params.month)
      : {
          from: params.from ? new Date(params.from) : undefined,
          to: params.to ? new Date(params.to) : undefined,
        };

    const [totals, categories] = await Promise.all([
      this.transactionRepository.sumExpenseByCategory(workspaceId, {
        from: range.from,
        to: range.to,
      }),
      this.categoryRepository.findByWorkspace(workspaceId, true),
    ]);

    const nameByCategoryId = new Map(
      categories.map((category) => [category.id, category.name]),
    );

    return totals
      .map((total) => ({
        categoryId: total.categoryId,
        name: nameByCategoryId.get(total.categoryId) ?? UNKNOWN_CATEGORY_NAME,
        value: Money.fromMinorUnits(total.total, defaultCurrency),
      }))
      .sort((a, b) =>
        a.value.amount < b.value.amount
          ? 1
          : a.value.amount > b.value.amount
            ? -1
            : 0,
      );
  }
}
