import { BaseService } from 'shared-kernel';
import { LIST_MONTHLY_BUDGET_BY_MONTH_SCHEMA } from 'budget-validation';
import type { IMonthlyBudgetRepository, MonthlyBudget } from 'budget-core';
import type { ServiceContext } from 'shared-kernel';

import { assertActiveCaller } from './assert-active-caller.js';
import type { BudgetServiceConfig } from './budget-service-config.js';

/** Input for {@link ListMonthlyBudgetsService}, matching `LIST_MONTHLY_BUDGET_BY_MONTH_SCHEMA`. */
export interface ListMonthlyBudgetsParams {
  /** Calendar month to list budgets for, `'YYYY-MM'`. */
  readonly month: string;
}

/** Dependencies {@link ListMonthlyBudgetsService} needs, injected via its constructor. */
export interface ListMonthlyBudgetsDeps {
  readonly monthlyBudgetRepository: IMonthlyBudgetRepository;
}

/**
 * Lists a workspace's `MonthlyBudget` entities for one calendar month.
 *
 * Framework-free `application` service — no DI decorators.
 */
export class ListMonthlyBudgetsService extends BaseService<
  ListMonthlyBudgetsParams,
  readonly MonthlyBudget[]
> {
  private readonly monthlyBudgetRepository: IMonthlyBudgetRepository;

  public constructor(deps: ListMonthlyBudgetsDeps) {
    super();
    this.monthlyBudgetRepository = deps.monthlyBudgetRepository;
  }

  protected override getValidationSchema(): Record<string, unknown> {
    return LIST_MONTHLY_BUDGET_BY_MONTH_SCHEMA;
  }

  protected override authorize(
    context: ServiceContext<BudgetServiceConfig>,
  ): void {
    assertActiveCaller(context);
  }

  protected override execute(
    params: ListMonthlyBudgetsParams,
    context: ServiceContext<BudgetServiceConfig>,
  ): Promise<readonly MonthlyBudget[]> {
    return this.monthlyBudgetRepository.findByWorkspaceAndMonth(
      context.config.workspaceId,
      params.month,
    );
  }
}
