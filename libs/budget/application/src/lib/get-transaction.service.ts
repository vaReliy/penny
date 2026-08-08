import { BaseService } from 'shared-kernel';
import { NotFoundError } from 'shared-errors';
import { ID_PATTERN } from 'shared-util';
import type { ITransactionRepository, Transaction } from 'budget-core';
import type { ServiceContext } from 'shared-kernel';

import { assertActiveCaller } from './assert-active-caller.js';
import type { BudgetServiceConfig } from './budget-service-config.js';

/** Input for {@link GetTransactionService}: the transaction to fetch. */
export interface GetTransactionParams {
  readonly id: string;
}

/** Dependencies {@link GetTransactionService} needs, injected via its constructor. */
export interface GetTransactionDeps {
  readonly transactionRepository: ITransactionRepository;
}

/**
 * LIVR schema for {@link GetTransactionParams}. No task-06 schema exists for
 * this action (`id` is a path parameter, not a request body) — validated
 * with the same `ID_PATTERN` `shared-util` exports for id-shaped fields,
 * mirroring `ArchiveCategoryService`'s local `ARCHIVE_CATEGORY_SCHEMA`.
 */
const GET_TRANSACTION_SCHEMA: Record<string, unknown> = {
  id: ['required', { like: ID_PATTERN }],
};

/**
 * Generic message shared by both "no such transaction" and "exists, but in
 * another workspace" — deliberately identical (and deliberately does not
 * echo `id` back, unlike the category not-found errors) so a caller cannot
 * use the error to probe for the existence of a transaction outside their
 * own workspace (no distinguishable "wrong workspace" error).
 */
function buildNotFoundError(): NotFoundError {
  return new NotFoundError('No transaction found with that id.');
}

/**
 * Fetches a single `Transaction` by id, scoped to the caller's workspace.
 *
 * Framework-free `application` service — no DI decorators. Uses
 * `findByIdInWorkspace` (never a bare `findById` + manual workspace check)
 * so a transaction belonging to a different workspace is indistinguishable
 * from one that does not exist at all — both yield the same generic
 * `NotFoundError`.
 */
export class GetTransactionService extends BaseService<
  GetTransactionParams,
  Transaction
> {
  private readonly transactionRepository: ITransactionRepository;

  public constructor(deps: GetTransactionDeps) {
    super();
    this.transactionRepository = deps.transactionRepository;
  }

  protected override getValidationSchema(): Record<string, unknown> {
    return GET_TRANSACTION_SCHEMA;
  }

  protected override authorize(
    context: ServiceContext<BudgetServiceConfig>,
  ): void {
    assertActiveCaller(context);
  }

  protected override async execute(
    params: GetTransactionParams,
    context: ServiceContext<BudgetServiceConfig>,
  ): Promise<Transaction> {
    const transaction = await this.transactionRepository.findByIdInWorkspace(
      params.id,
      context.config.workspaceId,
    );

    if (!transaction) {
      throw buildNotFoundError();
    }

    return transaction;
  }
}
