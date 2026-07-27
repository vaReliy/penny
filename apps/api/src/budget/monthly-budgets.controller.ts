import {
  Controller,
  Get,
  Put,
  Body,
  Query,
  Inject,
  UseGuards,
} from '@nestjs/common';

import type {
  UpsertMonthlyBudgetService,
  ListMonthlyBudgetsService,
} from 'budget-application';
import type {
  UpsertMonthlyBudgetRequest,
  ListMonthlyBudgetByMonthQuery,
  MonthlyBudgetResponse,
  MonthlyBudgetListResponse,
} from 'budget-contracts';
import type { MonthlyBudget } from 'budget-core';
import type { SessionUser } from 'shared-contracts';

import { SessionGuard } from '../auth/session.guard.js';
import { ActiveUserGuard } from '../auth/active-user.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { buildBudgetContext } from './build-budget-context.js';
import { TOKENS } from './tokens.js';

/** Maps a `budget-core` `MonthlyBudget` entity to its wire `MonthlyBudgetResponse` shape. */
function toMonthlyBudgetResponse(budget: MonthlyBudget): MonthlyBudgetResponse {
  return {
    id: budget.id,
    categoryId: budget.categoryId,
    month: budget.month,
    amount: budget.amount.toJSON(),
  };
}

/**
 * Thin HTTP surface for the budget vertical's `MonthlyBudget` operations.
 * Business logic (upsert-by-`(category, month)`, positivity) lives entirely
 * in `budget-application`; LIVR validation happens inside each service's
 * `validate` step (task 06) — this controller performs no validation of its
 * own, only request/response shape translation. Mirrors
 * `UserAdminController`'s guard/DI pattern.
 */
@Controller('budget/monthly-budgets')
@UseGuards(SessionGuard, ActiveUserGuard)
export class MonthlyBudgetsController {
  public constructor(
    @Inject(TOKENS.UpsertMonthlyBudget)
    private readonly upsertMonthlyBudget: UpsertMonthlyBudgetService,
    @Inject(TOKENS.ListMonthlyBudgets)
    private readonly listMonthlyBudgets: ListMonthlyBudgetsService,
  ) {}

  @Get()
  public async list(
    @Query() query: ListMonthlyBudgetByMonthQuery,
    @CurrentUser() user: SessionUser,
  ): Promise<MonthlyBudgetListResponse> {
    const { data } = await this.listMonthlyBudgets.run(
      { month: query.month },
      buildBudgetContext(user),
    );
    return data.map(toMonthlyBudgetResponse);
  }

  @Put()
  public async upsert(
    @Body() body: UpsertMonthlyBudgetRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<MonthlyBudgetResponse> {
    const { data } = await this.upsertMonthlyBudget.run(
      body,
      buildBudgetContext(user),
    );
    return toMonthlyBudgetResponse(data);
  }
}
