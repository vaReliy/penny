import { BaseService } from 'shared-kernel';
import { AuthenticationError } from 'shared-errors';
import { Money } from 'shared-util';
import { Transaction } from 'budget-core';
import { CREATE_TRANSACTION_SCHEMA } from 'budget-validation';
import type {
  IAccountRepository,
  ICategoryRepository,
  ITransactionRepository,
} from 'budget-core';
import type { TransactionType } from 'budget-contracts';
import type { ServiceContext } from 'shared-kernel';

import { assertActiveCaller } from './assert-active-caller.js';
import { AccountNotEligibleError } from './account-not-eligible-error.js';
import { CategoryNotEligibleError } from './category-not-eligible-error.js';
import type { BudgetServiceConfig } from './budget-service-config.js';

/** Input for {@link RecordTransactionService}, matching `CREATE_TRANSACTION_SCHEMA`. */
export interface RecordTransactionParams {
  readonly accountId: string;
  readonly categoryId: string;
  readonly type: TransactionType;
  /** Always positive, in integer minor units — sign is conveyed by `type`. */
  readonly amountMinorUnits: number;
  /** Economic date, `'YYYY-MM-DD'`. */
  readonly date: string;
  readonly description?: string;
}

/** Dependencies {@link RecordTransactionService} needs, injected via its constructor. */
export interface RecordTransactionDeps {
  readonly transactionRepository: ITransactionRepository;
  readonly categoryRepository: ICategoryRepository;
  readonly accountRepository: IAccountRepository;
}

/**
 * Records a new `Transaction` in the caller's workspace.
 *
 * Framework-free `application` service — no DI decorators. This is the money
 * path: it writes exactly one `Transaction` document and never touches a
 * stored account/category balance field — balance is derived on read by
 * aggregating transactions (per the budget domain model ADR, reversing the
 * legacy client-side balance mutation that caused a known race condition).
 *
 * `createdBy` is stamped from `context.caller.userId` — **never** from
 * `params` — so a caller cannot forge another user's audit trail by
 * supplying a `createdBy` field in the request body (the LIVR schema does
 * not even declare one, so it would be stripped regardless, but the
 * execute-time stamp is the actual enforcement point).
 */
export class RecordTransactionService extends BaseService<
  RecordTransactionParams,
  Transaction
> {
  private readonly transactionRepository: ITransactionRepository;
  private readonly categoryRepository: ICategoryRepository;
  private readonly accountRepository: IAccountRepository;

  public constructor(deps: RecordTransactionDeps) {
    super();
    this.transactionRepository = deps.transactionRepository;
    this.categoryRepository = deps.categoryRepository;
    this.accountRepository = deps.accountRepository;
  }

  protected override getValidationSchema(): Record<string, unknown> {
    return CREATE_TRANSACTION_SCHEMA;
  }

  protected override async authorize(
    context: ServiceContext<BudgetServiceConfig>,
    params: RecordTransactionParams,
  ): Promise<void> {
    assertActiveCaller(context);

    const { workspaceId } = context.config;
    const category = await this.categoryRepository.findByIdInWorkspace(
      params.categoryId,
      workspaceId,
    );
    if (!category || category.isArchived()) {
      throw new CategoryNotEligibleError(params.categoryId);
    }

    // TODO: once Account grows an archive/soft-delete field (mirroring
    // Category's), reject archived accounts here too.
    const account = await this.accountRepository.findByIdInWorkspace(
      params.accountId,
      workspaceId,
    );
    if (!account) {
      throw new AccountNotEligibleError(params.accountId);
    }
  }

  protected override async execute(
    params: RecordTransactionParams,
    context: ServiceContext<BudgetServiceConfig>,
  ): Promise<Transaction> {
    const { workspaceId, defaultCurrency } = context.config;

    // `assertActiveCaller` (run in `authorize`, always before `execute`)
    // already throws unless `context.caller` is present — this is a
    // narrowing re-check, not new authorization logic, done without a
    // non-null assertion.
    if (!context.caller) {
      throw new AuthenticationError();
    }
    const createdBy = context.caller.userId;

    const amount = Money.fromMinorUnits(
      params.amountMinorUnits,
      defaultCurrency,
    );

    // Placeholder id: the repository's `save` assigns the durable persisted
    // id on insert, mirroring `CreateCategoryService`'s convention.
    const transaction = Transaction.create(
      '',
      workspaceId,
      params.accountId,
      params.categoryId,
      params.type,
      amount,
      new Date(params.date),
      createdBy,
      params.description,
    );

    return this.transactionRepository.save(transaction);
  }
}
