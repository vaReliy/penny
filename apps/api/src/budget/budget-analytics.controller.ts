import { Controller, Get, Query, Inject, UseGuards } from '@nestjs/common';

import type {
  GetBalanceService,
  GetPlannerSummaryService,
  GetHistoryChartService,
  PlannerCategorySummaryResult,
} from 'budget-application';
import type {
  BalanceResponse,
  PlannerSummaryFilterQuery,
  PlannerSummaryResponse,
  PlannerCategorySummary,
  HistoryChartFilterQuery,
  HistoryChartResponse,
} from 'budget-contracts';
import type { IAccountRepository } from 'budget-core';
import type { SessionUser } from 'shared-contracts';

import { SessionGuard } from '../auth/session.guard.js';
import { ActiveUserGuard } from '../auth/active-user.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { CurrentMembership } from '../auth/current-membership.decorator.js';
import { WorkspaceMemberGuard } from '../workspace/workspace-member.guard.js';
import type { RequestWorkspaceMembership } from '../workspace/workspace-membership.js';
import { buildBudgetContext } from './build-budget-context.js';
import { resolveDefaultAccount } from './resolve-default-account.js';
import { TOKENS } from './tokens.js';

/** Maps one `PlannerCategorySummaryResult` to its wire `PlannerCategorySummary` shape (drops the application-only `percent` field — not part of the `budget-contracts` wire DTO). */
function toPlannerCategorySummary(
  result: PlannerCategorySummaryResult,
): PlannerCategorySummary {
  return {
    categoryId: result.categoryId,
    budgeted: result.budgeted.toJSON(),
    spent: result.spent.toJSON(),
    remaining: result.remaining.toJSON(),
  };
}

/**
 * Thin HTTP surface for the budget vertical's read-model/analytics
 * endpoints (`GetBalanceService`, `GetPlannerSummaryService`,
 * `GetHistoryChartService`). Business logic lives entirely in
 * `budget-application`; LIVR validation happens inside each service's
 * `validate` step — this controller performs no validation of its own, only
 * request/response shape translation and (for `balance`) resolving the
 * MVP-single-seeded `accountId` `GetBalanceService` requires but this
 * endpoint's own contract does not expose as a caller-supplied field (see
 * `resolveDefaultAccount`). Mirrors `CategoriesController`'s guard/DI
 * pattern.
 */
@Controller('workspaces/:workspaceId/budget')
@UseGuards(SessionGuard, ActiveUserGuard, WorkspaceMemberGuard)
export class BudgetAnalyticsController {
  public constructor(
    @Inject(TOKENS.AccountRepository)
    private readonly accountRepository: IAccountRepository,
    @Inject(TOKENS.GetBalance)
    private readonly getBalance: GetBalanceService,
    @Inject(TOKENS.GetPlannerSummary)
    private readonly getPlannerSummary: GetPlannerSummaryService,
    @Inject(TOKENS.GetHistoryChart)
    private readonly getHistoryChart: GetHistoryChartService,
  ) {}

  @Get('balance')
  public async balance(
    @CurrentUser() user: SessionUser,
    @CurrentMembership() membership: RequestWorkspaceMembership,
  ): Promise<BalanceResponse> {
    const context = buildBudgetContext(user, membership);
    const account = await resolveDefaultAccount(
      this.accountRepository,
      context.config.workspaceId,
      context.config.defaultCurrency,
    );

    const { data } = await this.getBalance.run(
      { accountId: account.id },
      context,
    );

    return { accountId: account.id, balance: data.toJSON() };
  }

  @Get('summary')
  public async summary(
    @Query() query: PlannerSummaryFilterQuery,
    @CurrentUser() user: SessionUser,
    @CurrentMembership() membership: RequestWorkspaceMembership,
  ): Promise<PlannerSummaryResponse> {
    const { data } = await this.getPlannerSummary.run(
      { month: query.month },
      buildBudgetContext(user, membership),
    );

    return {
      month: data.month,
      categories: data.categories.map(toPlannerCategorySummary),
    };
  }

  @Get('chart')
  public async chart(
    @Query() query: HistoryChartFilterQuery,
    @CurrentUser() user: SessionUser,
    @CurrentMembership() membership: RequestWorkspaceMembership,
  ): Promise<HistoryChartResponse> {
    // Express builds `req.query` with a null prototype, which LIVR rejects
    // as a non-object — spread it into a plain object before validation.
    const { data } = await this.getHistoryChart.run(
      { ...query },
      buildBudgetContext(user, membership),
    );

    return data.map((entry) => ({
      categoryId: entry.categoryId,
      name: entry.name,
      value: entry.value.toJSON(),
    }));
  }
}
