import { AuthenticationError } from 'shared-errors';
import { Money } from 'shared-util';
import { Transaction } from 'budget-core';
import { UserStatus } from 'shared-contracts';
import { ServiceValidationError } from 'shared-kernel';
import type {
  ITransactionRepository,
  TransactionFilter,
  TransactionTypeTotals,
  CategoryExpenseTotal,
} from 'budget-core';
import type { CallerIdentity, ServiceContext } from 'shared-kernel';
import { beforeEach, describe, expect, it } from 'vitest';

import { ListTransactionsService } from './list-transactions.service.js';
import type { BudgetServiceConfig } from './budget-service-config.js';

/** In-memory `ITransactionRepository` fake applying the same narrowing rules as the real Mongo repo would. */
class FakeTransactionRepository implements ITransactionRepository {
  private readonly all: Transaction[] = [];
  public lastFilter: TransactionFilter | undefined;

  public seed(tx: Transaction): void {
    this.all.push(tx);
  }

  public async findById(id: string): Promise<Transaction | null> {
    return this.all.find((tx) => tx.id === id) ?? null;
  }

  public async findByWorkspace(
    workspaceId: string,
    filter?: TransactionFilter,
  ): Promise<Transaction[]> {
    this.lastFilter = filter;
    return this.all.filter((tx) => {
      if (tx.workspaceId !== workspaceId) return false;
      if (filter?.type && tx.type !== filter.type) return false;
      if (filter?.categoryId && tx.categoryId !== filter.categoryId)
        return false;
      if (filter?.accountId && tx.accountId !== filter.accountId) return false;
      if (filter?.from && tx.date.getTime() < filter.from.getTime())
        return false;
      if (filter?.to && tx.date.getTime() >= filter.to.getTime()) return false;
      return true;
    });
  }

  public async findByIdInWorkspace(
    id: string,
    workspaceId: string,
  ): Promise<Transaction | null> {
    const tx = this.all.find((t) => t.id === id);
    return tx && tx.workspaceId === workspaceId ? tx : null;
  }

  public async existsForCategory(): Promise<boolean> {
    return false;
  }

  public async updateInWorkspace(): Promise<void> {
    // Unused by this suite.
  }

  public async deleteInWorkspace(): Promise<void> {
    // Unused by this suite.
  }

  public async sumAmountsByType(): Promise<TransactionTypeTotals> {
    return { income: 0n, expense: 0n };
  }

  public async sumExpenseByCategory(): Promise<CategoryExpenseTotal[]> {
    return [];
  }

  public async save(entity: Transaction): Promise<Transaction> {
    this.all.push(entity);
    return entity;
  }

  public async delete(id: string): Promise<void> {
    const index = this.all.findIndex((tx) => tx.id === id);
    if (index >= 0) this.all.splice(index, 1);
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

const CATEGORY_A = '507f1f77bcf86cd799439011';
const CATEGORY_B = '507f1f77bcf86cd799439012';
const ACCOUNT_ID = '507f1f77bcf86cd799439022';

function makeTx(
  id: string,
  date: string,
  type: 'income' | 'expense' = 'expense',
  categoryId: string = CATEGORY_A,
  createdAt: Date = new Date(date),
): Transaction {
  return Transaction.create(
    id,
    'ws-1',
    ACCOUNT_ID,
    categoryId,
    type,
    Money.fromMinorUnits(1_000, 'UAH'),
    new Date(date),
    'user-1',
    undefined,
    createdAt,
  );
}

describe('ListTransactionsService', () => {
  let repository: FakeTransactionRepository;
  let service: ListTransactionsService;

  beforeEach(() => {
    repository = new FakeTransactionRepository();
    service = new ListTransactionsService({
      transactionRepository: repository,
    });
  });

  it('lists transactions newest-first by default', async () => {
    repository.seed(makeTx('tx-1', '2026-07-01'));
    repository.seed(makeTx('tx-2', '2026-07-15'));
    repository.seed(makeTx('tx-3', '2026-07-08'));

    const outcome = await service.run(
      { month: '2026-07' },
      buildContext(ACTIVE_CALLER),
    );

    expect(outcome.data.map((tx) => tx.id)).toEqual(['tx-2', 'tx-3', 'tx-1']);
  });

  it('filters by type', async () => {
    repository.seed(makeTx('tx-income', '2026-07-01', 'income'));
    repository.seed(makeTx('tx-expense', '2026-07-02', 'expense'));

    const outcome = await service.run(
      { type: 'income', month: '2026-07' },
      buildContext(ACTIVE_CALLER),
    );

    expect(outcome.data.map((tx) => tx.id)).toEqual(['tx-income']);
  });

  it('filters by categoryId', async () => {
    repository.seed(makeTx('tx-a', '2026-07-01', 'expense', CATEGORY_A));
    repository.seed(makeTx('tx-b', '2026-07-02', 'expense', CATEGORY_B));

    const outcome = await service.run(
      { categoryId: CATEGORY_B, month: '2026-07' },
      buildContext(ACTIVE_CALLER),
    );

    expect(outcome.data.map((tx) => tx.id)).toEqual(['tx-b']);
  });

  it('filters by accountId', async () => {
    const otherAccountId = '507f1f77bcf86cd799439077';
    repository.seed(makeTx('tx-account-a', '2026-07-01'));
    repository.seed(
      Transaction.create(
        'tx-account-b',
        'ws-1',
        otherAccountId,
        CATEGORY_A,
        'expense',
        Money.fromMinorUnits(1_000, 'UAH'),
        new Date('2026-07-02'),
        'user-1',
      ),
    );

    const outcome = await service.run(
      { accountId: otherAccountId, month: '2026-07' },
      buildContext(ACTIVE_CALLER),
    );

    expect(outcome.data.map((tx) => tx.id)).toEqual(['tx-account-b']);
  });

  it('breaks same-date ties by createdAt, newest first', async () => {
    repository.seed(
      makeTx(
        'tx-earlier-created',
        '2026-07-10',
        'expense',
        CATEGORY_A,
        new Date('2026-07-10T08:00:00.000Z'),
      ),
    );
    repository.seed(
      makeTx(
        'tx-later-created',
        '2026-07-10',
        'expense',
        CATEGORY_A,
        new Date('2026-07-10T18:00:00.000Z'),
      ),
    );

    const outcome = await service.run(
      { month: '2026-07' },
      buildContext(ACTIVE_CALLER),
    );

    expect(outcome.data.map((tx) => tx.id)).toEqual([
      'tx-later-created',
      'tx-earlier-created',
    ]);
  });

  it('filters by an explicit from/to date range', async () => {
    repository.seed(makeTx('tx-early', '2026-06-15'));
    repository.seed(makeTx('tx-mid', '2026-07-15'));
    repository.seed(makeTx('tx-late', '2026-08-15'));

    const outcome = await service.run(
      { from: '2026-07-01', to: '2026-08-01' },
      buildContext(ACTIVE_CALLER),
    );

    expect(outcome.data.map((tx) => tx.id)).toEqual(['tx-mid']);
  });

  it('filters by month, resolving to a Kyiv-local instant range', async () => {
    repository.seed(makeTx('tx-june-30-late', '2026-06-30T22:00:00.000Z')); // 2026-07-01 01:00 Kyiv (EEST, UTC+3)
    repository.seed(makeTx('tx-july-mid', '2026-07-15T12:00:00.000Z'));
    repository.seed(makeTx('tx-aug-1-early', '2026-07-31T22:00:00.000Z')); // 2026-08-01 01:00 Kyiv

    const outcome = await service.run(
      { month: '2026-07' },
      buildContext(ACTIVE_CALLER),
    );

    expect(outcome.data.map((tx) => tx.id).sort()).toEqual(
      ['tx-june-30-late', 'tx-july-mid'].sort(),
    );
  });

  it('month filter takes precedence over an also-supplied from/to', async () => {
    repository.seed(makeTx('tx-july', '2026-07-15'));
    repository.seed(makeTx('tx-august', '2026-08-15'));

    const outcome = await service.run(
      { month: '2026-07', from: '2026-08-01', to: '2026-09-01' },
      buildContext(ACTIVE_CALLER),
    );

    expect(outcome.data.map((tx) => tx.id)).toEqual(['tx-july']);
  });

  it('returns an empty list when nothing matches', async () => {
    const outcome = await service.run(
      { month: '2026-07' },
      buildContext(ACTIVE_CALLER),
    );

    expect(outcome.data).toEqual([]);
  });

  it('throws ServiceValidationError for a malformed month', async () => {
    await expect(
      service.run({ month: 'bad-month' }, buildContext(ACTIVE_CALLER)),
    ).rejects.toBeInstanceOf(ServiceValidationError);
  });

  it('throws ServiceValidationError when no period-scoping filter is given', async () => {
    await expect(
      service.run({}, buildContext(ACTIVE_CALLER)),
    ).rejects.toBeInstanceOf(ServiceValidationError);
  });

  it('throws ServiceValidationError when only from (without to) is given', async () => {
    await expect(
      service.run({ from: '2026-07-01' }, buildContext(ACTIVE_CALLER)),
    ).rejects.toBeInstanceOf(ServiceValidationError);
  });

  it('throws AuthenticationError for a non-active caller', async () => {
    await expect(
      service.run({}, buildContext(PENDING_CALLER)),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('throws AuthenticationError when there is no caller at all', async () => {
    await expect(service.run({}, buildContext(null))).rejects.toBeInstanceOf(
      AuthenticationError,
    );
  });
});
