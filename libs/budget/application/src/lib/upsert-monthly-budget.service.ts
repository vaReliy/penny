import { BaseService } from 'shared-kernel';
import { Money } from 'shared-util';
import { MonthlyBudget } from 'budget-core';
import type { IMonthlyBudgetRepository } from 'budget-core';
import type { ServiceContext } from 'shared-kernel';

import { assertActiveCaller } from './assert-active-caller.js';
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
}

/**
 * Creates or replaces the spending ceiling for one `(category, month)` pair
 * in the caller's workspace.
 *
 * Framework-free `application` service — no DI decorators. Per the budget
 * domain model ADR ("Any category may be budgeted"), this service does
 * **not** validate that `categoryId` refers to an existing, non-archived
 * category — that free-form-MVP risk is a deliberate owner decision (Q3
 * addendum), not an oversight. `MonthlyBudget.create` still validates
 * `month` shape and that `amount` is strictly positive.
 */
export class UpsertMonthlyBudgetService extends BaseService<
  UpsertMonthlyBudgetParams,
  MonthlyBudget
> {
  private readonly monthlyBudgetRepository: IMonthlyBudgetRepository;

  public constructor(deps: UpsertMonthlyBudgetDeps) {
    super();
    this.monthlyBudgetRepository = deps.monthlyBudgetRepository;
  }

  protected override getValidationSchema(): Record<string, unknown> {
    return UPSERT_MONTHLY_BUDGET_SCHEMA;
  }

  protected override authorize(
    context: ServiceContext<BudgetServiceConfig>,
  ): void {
    assertActiveCaller(context);
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
