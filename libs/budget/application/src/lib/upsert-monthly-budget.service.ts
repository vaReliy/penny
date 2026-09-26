import { BaseService } from 'shared-kernel';
import { Money } from 'shared-util';
import { MonthlyBudget } from 'budget-core';
import type {
  ICategoryRepository,
  IMonthlyBudgetRepository,
} from 'budget-core';
import type { ServiceContext } from 'shared-kernel';

import { assertActiveCaller } from './assert-active-caller.js';
import { CategoryNotEligibleError } from './category-not-eligible-error.js';
import { UPSERT_MONTHLY_BUDGET_SCHEMA } from './upsert-monthly-budget.schema.js';
import type { BudgetServiceConfig } from './budget-service-config.js';

/** Input for {@link UpsertMonthlyBudgetService}, matching `UPSERT_MONTHLY_BUDGET_SCHEMA`. */
export interface UpsertMonthlyBudgetParams {
  readonly categoryId: string;
  /** Calendar month this budget targets, `'YYYY-MM'`. */
  readonly month: string;
  /** Ceiling target for expense spending, in integer minor units. */
  readonly amountMinorUnits: number;
}

/** Dependencies {@link UpsertMonthlyBudgetService} needs, injected via its constructor. */
export interface UpsertMonthlyBudgetDeps {
  readonly monthlyBudgetRepository: IMonthlyBudgetRepository;
  readonly categoryRepository: ICategoryRepository;
}

/**
 * Creates or replaces the spending ceiling for one `(category, month)` pair
 * in the caller's workspace.
 *
 * Framework-free `application` service — no DI decorators. `categoryId`
 * must name a category in the caller's workspace (rejected with
 * `CategoryNotEligibleError` otherwise, before any write), so a budget can
 * never reference another workspace's category. Archived categories stay
 * budgetable, per the budget domain model ADR ("Any category may be
 * budgeted"). `MonthlyBudget.create` still validates `month` shape and that
 * `amount` is strictly positive.
 */
export class UpsertMonthlyBudgetService extends BaseService<
  UpsertMonthlyBudgetParams,
  MonthlyBudget
> {
  private readonly monthlyBudgetRepository: IMonthlyBudgetRepository;
  private readonly categoryRepository: ICategoryRepository;

  public constructor(deps: UpsertMonthlyBudgetDeps) {
    super();
    this.monthlyBudgetRepository = deps.monthlyBudgetRepository;
    this.categoryRepository = deps.categoryRepository;
  }

  protected override getValidationSchema(): Record<string, unknown> {
    return UPSERT_MONTHLY_BUDGET_SCHEMA;
  }

  protected override async authorize(
    context: ServiceContext<BudgetServiceConfig>,
    params: UpsertMonthlyBudgetParams,
  ): Promise<void> {
    assertActiveCaller(context);

    const category = await this.categoryRepository.findByIdInWorkspace(
      params.categoryId,
      context.config.workspaceId,
    );
    if (!category) {
      throw new CategoryNotEligibleError(params.categoryId);
    }
  }

  protected override async execute(
    params: UpsertMonthlyBudgetParams,
    context: ServiceContext<BudgetServiceConfig>,
  ): Promise<MonthlyBudget> {
    const { workspaceId, defaultCurrency } = context.config;

    const amount = Money.fromMinorUnits(
      params.amountMinorUnits,
      defaultCurrency,
    );

    // Validates shape/positivity (throws DomainError if invalid) before any
    // write; the persisted id is assigned by the infrastructure layer.
    const budget = MonthlyBudget.create(
      '',
      workspaceId,
      params.categoryId,
      params.month,
      amount,
    );

    await this.monthlyBudgetRepository.upsertAmount(
      workspaceId,
      params.categoryId,
      params.month,
      amount,
    );

    const persisted =
      await this.monthlyBudgetRepository.findByWorkspaceCategoryMonth(
        workspaceId,
        params.categoryId,
        params.month,
      );

    return persisted ?? budget;
  }
}
