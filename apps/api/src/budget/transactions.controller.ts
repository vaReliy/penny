import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Inject,
  UseGuards,
} from '@nestjs/common';

import type {
  RecordTransactionService,
  ListTransactionsService,
  GetTransactionService,
} from 'budget-application';
import type {
  CreateTransactionRequest,
  TransactionFilterQuery,
  TransactionResponse,
  TransactionListResponse,
} from 'budget-contracts';
import type { Transaction } from 'budget-core';
import type { SessionUser } from 'shared-contracts';

import { SessionGuard } from '../auth/session.guard.js';
import { ActiveUserGuard } from '../auth/active-user.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { buildBudgetContext } from './build-budget-context.js';
import { TOKENS } from './tokens.js';

/** Maps a `budget-core` `Transaction` entity to its wire `TransactionResponse` shape. */
function toTransactionResponse(transaction: Transaction): TransactionResponse {
  return {
    id: transaction.id,
    accountId: transaction.accountId,
    categoryId: transaction.categoryId,
    type: transaction.type,
    amount: transaction.amount.toJSON(),
    date: transaction.date.toISOString().slice(0, 10),
    ...(transaction.description !== undefined
      ? { description: transaction.description }
      : {}),
    createdBy: transaction.createdBy,
    createdAt: transaction.createdAt.toISOString(),
  };
}

/**
 * Thin HTTP surface for the budget vertical's `Transaction` operations —
 * the money-write path (`POST`) plus the read models the transaction list
 * and detail screens consume. Business logic (category-eligibility check on
 * record, mandatory period-scoping on list) lives entirely in
 * `budget-application`; LIVR validation happens inside each service's
 * `validate` step — this controller performs no validation of its own, only
 * request/response shape translation. Mirrors `CategoriesController`'s
 * guard/DI pattern.
 *
 * Rate-limiting decision (recorded per this task's requirement): `POST` is
 * **not** throttled, unlike `POST /api/auth/telegram`
 * (`telegram-login-throttle.constants.ts`). That endpoint is reachable
 * pre-authentication by anyone with a Telegram account — throttling guards
 * against anonymous credential-stuffing/brute force. This endpoint requires
 * an already-established session **and** `ActiveUserGuard`'s
 * admin-approved-active status — the same trust bar every other budget
 * write endpoint (`CategoriesController.create`,
 * `MonthlyBudgetsController.upsert`) already ships with unthrottled. Adding
 * per-route throttling here without applying it consistently to every other
 * authenticated write would be an arbitrary inconsistency, not a
 * risk-calibrated decision — so existing session + active-user gating is
 * judged sufficient at MVP (single-workspace, family-scale) scale. Revisit
 * if/when the workspace feature admits many concurrent members per
 * workspace.
 */
@Controller('budget/transactions')
@UseGuards(SessionGuard, ActiveUserGuard)
export class TransactionsController {
  public constructor(
    @Inject(TOKENS.RecordTransaction)
    private readonly recordTransaction: RecordTransactionService,
    @Inject(TOKENS.ListTransactions)
    private readonly listTransactions: ListTransactionsService,
    @Inject(TOKENS.GetTransaction)
    private readonly getTransaction: GetTransactionService,
  ) {}

  @Post()
  public async record(
    @Body() body: CreateTransactionRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<TransactionResponse> {
    const { data } = await this.recordTransaction.run(
      body,
      buildBudgetContext(user),
    );
    return toTransactionResponse(data);
  }

  @Get()
  public async list(
    @Query() query: TransactionFilterQuery,
    @CurrentUser() user: SessionUser,
  ): Promise<TransactionListResponse> {
    // Express builds `req.query` with a null prototype, which LIVR rejects
    // as a non-object — spread it into a plain object before validation.
    const { data } = await this.listTransactions.run(
      { ...query },
      buildBudgetContext(user),
    );
    return data.map(toTransactionResponse);
  }

  @Get(':id')
  public async get(
    @Param('id') id: string,
    @CurrentUser() user: SessionUser,
  ): Promise<TransactionResponse> {
    const { data } = await this.getTransaction.run(
      { id },
      buildBudgetContext(user),
    );
    return toTransactionResponse(data);
  }
}
