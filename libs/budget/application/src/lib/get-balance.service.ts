import { BaseService } from 'shared-kernel';
import { NotFoundError } from 'shared-errors';
import { ID_PATTERN, Money } from 'shared-util';
import type { IAccountRepository, ITransactionRepository } from 'budget-core';
import type { ServiceContext } from 'shared-kernel';

import { assertActiveCaller } from './assert-active-caller.js';
import type { BudgetServiceConfig } from './budget-service-config.js';

/** Input for {@link GetBalanceService}: the account to derive a balance for. */
export interface GetBalanceParams {
  readonly accountId: string;
}

/** Dependencies {@link GetBalanceService} needs, injected via its constructor. */
export interface GetBalanceDeps {
  readonly accountRepository: IAccountRepository;
  readonly transactionRepository: ITransactionRepository;
}

/**
 * LIVR schema for {@link GetBalanceParams}. No task-06 schema exists for this
 * action (`accountId` is a path parameter, not a request body) — validated
 * with the same `ID_PATTERN` `shared-util` exports for id-shaped fields,
 * mirroring `GetTransactionService`'s local `GET_TRANSACTION_SCHEMA`.
 */
const GET_BALANCE_SCHEMA: Record<string, unknown> = {
  accountId: ['required', { like: ID_PATTERN }],
};

/** Message used when `accountId` does not resolve to an account in the caller's workspace. */
function buildNotFoundError(): NotFoundError {
  return new NotFoundError('No account found with that id.');
}

/**
 * Derives one account's balance: `Σ(income) − Σ(expense)` over every
 * transaction attributed to it, per the budget domain model ADR's derived-
 * balance strategy (no stored balance field, no read-modify-write race).
 *
 * Framework-free `application` service — no DI decorators. Delegates the
 * summation itself to `ITransactionRepository.sumAmountsByType` (a repo
 * aggregation, never an in-memory reduce over the full transaction set —
 * D1) and only performs the final subtraction and `Money` construction here,
 * using the account's own currency (never `context.config.defaultCurrency`
 * directly — that value seeds `Account.currency` at creation time, but this
 * service reads it back off the resolved `Account`, keeping a future
 * multi-currency account irrelevant to this call site).
 */
export class GetBalanceService extends BaseService<GetBalanceParams, Money> {
  private readonly accountRepository: IAccountRepository;
  private readonly transactionRepository: ITransactionRepository;

  public constructor(deps: GetBalanceDeps) {
    super();
    this.accountRepository = deps.accountRepository;
    this.transactionRepository = deps.transactionRepository;
  }

  protected override getValidationSchema(): Record<string, unknown> {
    return GET_BALANCE_SCHEMA;
  }

  protected override authorize(
    context: ServiceContext<BudgetServiceConfig>,
  ): void {
    assertActiveCaller(context);
  }

  protected override async execute(
    params: GetBalanceParams,
    context: ServiceContext<BudgetServiceConfig>,
  ): Promise<Money> {
    const { workspaceId } = context.config;

    const account = await this.accountRepository.findByIdInWorkspace(
      params.accountId,
      workspaceId,
    );
    if (!account) {
      throw buildNotFoundError();
    }

    const totals = await this.transactionRepository.sumAmountsByType(
      workspaceId,
      { accountId: account.id },
    );

    return Money.fromMinorUnits(
      totals.income - totals.expense,
      account.currency,
    );
  }
}
