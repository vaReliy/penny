import { AuthenticationError, NotFoundError } from 'shared-errors';
import { Account } from 'budget-core';
import { UserStatus } from 'shared-contracts';
import { ServiceValidationError } from 'shared-kernel';
import type {
  CategoryExpenseTotal,
  IAccountRepository,
  ITransactionRepository,
  TransactionAggregationFilter,
  TransactionTypeTotals,
} from 'budget-core';
import type { CallerIdentity, ServiceContext } from 'shared-kernel';
import { beforeEach, describe, expect, it } from 'vitest';

import { GetBalanceService } from './get-balance.service.js';
import type { BudgetServiceConfig } from './budget-service-config.js';

/** In-memory `IAccountRepository` fake, keyed by `id`. */
class FakeAccountRepository implements IAccountRepository {
  private readonly accountsById = new Map<string, Account>();

  public seed(account: Account): void {
    this.accountsById.set(account.id, account);
  }

  public async findById(id: string): Promise<Account | null> {
    return this.accountsById.get(id) ?? null;
  }

  public async findByWorkspace(workspaceId: string): Promise<Account[]> {
    return [...this.accountsById.values()].filter(
      (account) => account.workspaceId === workspaceId,
    );
  }

  public async findByIdInWorkspace(
    id: string,
    workspaceId: string,
  ): Promise<Account | null> {
    const account = this.accountsById.get(id);
    return account && account.workspaceId === workspaceId ? account : null;
  }

  public async save(entity: Account): Promise<Account> {
    this.accountsById.set(entity.id, entity);
    return entity;
  }

  public async delete(id: string): Promise<void> {
    this.accountsById.delete(id);
  }
}

/** In-memory `ITransactionRepository` fake exposing only the aggregation methods this suite needs. */
class FakeTransactionRepository implements ITransactionRepository {
  public lastSumFilter: TransactionAggregationFilter | undefined;
  private totals: TransactionTypeTotals = { income: 0n, expense: 0n };

  public setTotals(totals: TransactionTypeTotals): void {
    this.totals = totals;
  }

  public async findById() {
    return null;
  }

  public async findByWorkspace() {
    return [];
  }

  public async findByIdInWorkspace() {
    return null;
  }

  public async existsForCategory() {
    return false;
  }

  public async updateInWorkspace() {
    // Unused by this suite.
  }

  public async deleteInWorkspace() {
    // Unused by this suite.
  }

  public async sumAmountsByType(
    _workspaceId: string,
    filter?: TransactionAggregationFilter,
  ): Promise<TransactionTypeTotals> {
    this.lastSumFilter = filter;
    return this.totals;
  }

  public async sumExpenseByCategory(): Promise<CategoryExpenseTotal[]> {
    return [];
  }

  public async save(entity: never): Promise<never> {
    return entity;
  }

  public async delete(): Promise<void> {
    // Unused by this suite.
  }
}

function buildContext(
  caller: CallerIdentity | null,
): ServiceContext<BudgetServiceConfig> {
  return {
    config: { workspaceId: 'ws-1', defaultCurrency: 'UAH' },
    caller,
  };
}

const ACTIVE_CALLER: CallerIdentity = {
  userId: 'user-1',
  status: UserStatus.ACTIVE,
  roles: [],
};

const PENDING_CALLER: CallerIdentity = {
  userId: 'user-2',
  status: UserStatus.PENDING,
  roles: [],
};

const ACCOUNT_ID = '507f1f77bcf86cd799439011';
const UNKNOWN_ACCOUNT_ID = '507f1f77bcf86cd799439099';

describe('GetBalanceService', () => {
  let accountRepository: FakeAccountRepository;
  let transactionRepository: FakeTransactionRepository;
  let service: GetBalanceService;

  beforeEach(() => {
    accountRepository = new FakeAccountRepository();
    transactionRepository = new FakeTransactionRepository();
    service = new GetBalanceService({
      accountRepository,
      transactionRepository,
    });
    accountRepository.seed(
      Account.create(ACCOUNT_ID, 'ws-1', 'Main', 'UAH', new Date('2026-01-01')),
    );
  });

  it('derives balance as income minus expense', async () => {
    transactionRepository.setTotals({ income: 10_000n, expense: 4_000n });

    const outcome = await service.run(
      { accountId: ACCOUNT_ID },
      buildContext(ACTIVE_CALLER),
    );

    expect(outcome.data.amount).toBe(6_000n);
    expect(outcome.data.currency).toBe('UAH');
  });

  it('returns a zero balance for an account with no transactions', async () => {
    transactionRepository.setTotals({ income: 0n, expense: 0n });

    const outcome = await service.run(
      { accountId: ACCOUNT_ID },
      buildContext(ACTIVE_CALLER),
    );

    expect(outcome.data.isZero()).toBe(true);
  });

  it('returns a negative balance when expenses exceed income', async () => {
    transactionRepository.setTotals({ income: 1_000n, expense: 5_000n });

    const outcome = await service.run(
      { accountId: ACCOUNT_ID },
      buildContext(ACTIVE_CALLER),
    );

    expect(outcome.data.amount).toBe(-4_000n);
    expect(outcome.data.isNegative()).toBe(true);
  });

  it('scopes the aggregation to the resolved account', async () => {
    transactionRepository.setTotals({ income: 1_000n, expense: 0n });

    await service.run({ accountId: ACCOUNT_ID }, buildContext(ACTIVE_CALLER));

    expect(transactionRepository.lastSumFilter).toEqual({
      accountId: ACCOUNT_ID,
    });
  });

  it('throws ServiceValidationError when accountId does not look like an id', async () => {
    await expect(
      service.run({ accountId: 'not-an-id' }, buildContext(ACTIVE_CALLER)),
    ).rejects.toBeInstanceOf(ServiceValidationError);
  });

  it('throws AuthenticationError for a non-active caller', async () => {
    await expect(
      service.run({ accountId: ACCOUNT_ID }, buildContext(PENDING_CALLER)),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('throws NotFoundError when the account does not exist in the workspace', async () => {
    await expect(
      service.run(
        { accountId: UNKNOWN_ACCOUNT_ID },
        buildContext(ACTIVE_CALLER),
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws NotFoundError when the account belongs to a different workspace', async () => {
    accountRepository.seed(
      Account.create(
        '507f1f77bcf86cd799439055',
        'ws-other',
        'Other',
        'UAH',
        new Date(),
      ),
    );

    await expect(
      service.run(
        { accountId: '507f1f77bcf86cd799439055' },
        buildContext(ACTIVE_CALLER),
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
