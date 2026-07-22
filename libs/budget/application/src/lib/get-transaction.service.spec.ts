import { AuthenticationError, NotFoundError } from 'shared-errors';
import { Money } from 'shared-util';
import { Transaction } from 'budget-core';
import { UserStatus } from 'shared-contracts';
import { ServiceValidationError } from 'shared-kernel';
import type {
  ITransactionRepository,
  TransactionTypeTotals,
  CategoryExpenseTotal,
} from 'budget-core';
import type { CallerIdentity, ServiceContext } from 'shared-kernel';
import { beforeEach, describe, expect, it } from 'vitest';

import { GetTransactionService } from './get-transaction.service.js';
import type { BudgetServiceConfig } from './budget-service-config.js';

/** In-memory `ITransactionRepository` fake, keyed by `id`. */
class FakeTransactionRepository implements ITransactionRepository {
  private readonly byId = new Map<string, Transaction>();

  public seed(tx: Transaction): void {
    this.byId.set(tx.id, tx);
  }

  public async findById(id: string): Promise<Transaction | null> {
    return this.byId.get(id) ?? null;
  }

  public async findByWorkspace(workspaceId: string): Promise<Transaction[]> {
    return [...this.byId.values()].filter(
      (tx) => tx.workspaceId === workspaceId,
    );
  }

  public async findByIdInWorkspace(
    id: string,
    workspaceId: string,
  ): Promise<Transaction | null> {
    const tx = this.byId.get(id);
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
    this.byId.set(entity.id, entity);
    return entity;
  }

  public async delete(id: string): Promise<void> {
    this.byId.delete(id);
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

const TX_ID = '507f1f77bcf86cd799439011';
const OTHER_WORKSPACE_TX_ID = '507f1f77bcf86cd799439022';
const UNKNOWN_TX_ID = '507f1f77bcf86cd799439099';
const CATEGORY_ID = '507f1f77bcf86cd799439033';
const ACCOUNT_ID = '507f1f77bcf86cd799439044';

describe('GetTransactionService', () => {
  let repository: FakeTransactionRepository;
  let service: GetTransactionService;

  beforeEach(() => {
    repository = new FakeTransactionRepository();
    service = new GetTransactionService({ transactionRepository: repository });

    repository.seed(
      Transaction.create(
        TX_ID,
        'ws-1',
        ACCOUNT_ID,
        CATEGORY_ID,
        'expense',
        Money.fromMinorUnits(2_000, 'UAH'),
        new Date('2026-07-10'),
        'user-1',
      ),
    );
    repository.seed(
      Transaction.create(
        OTHER_WORKSPACE_TX_ID,
        'ws-other',
        ACCOUNT_ID,
        CATEGORY_ID,
        'expense',
        Money.fromMinorUnits(2_000, 'UAH'),
        new Date('2026-07-10'),
        'user-9',
      ),
    );
  });

  it('fetches a transaction by id, scoped to the caller workspace', async () => {
    const outcome = await service.run(
      { id: TX_ID },
      buildContext(ACTIVE_CALLER),
    );

    expect(outcome.data.id).toBe(TX_ID);
  });

  it('throws NotFoundError when the transaction does not exist at all', async () => {
    await expect(
      service.run({ id: UNKNOWN_TX_ID }, buildContext(ACTIVE_CALLER)),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws the same NotFoundError (no distinguishable leak) for a transaction in another workspace', async () => {
    let ownWorkspaceError: unknown;
    let otherWorkspaceError: unknown;

    await service
      .run({ id: UNKNOWN_TX_ID }, buildContext(ACTIVE_CALLER))
      .catch((err: unknown) => {
        ownWorkspaceError = err;
      });
    await service
      .run({ id: OTHER_WORKSPACE_TX_ID }, buildContext(ACTIVE_CALLER))
      .catch((err: unknown) => {
        otherWorkspaceError = err;
      });

    expect(ownWorkspaceError).toBeInstanceOf(NotFoundError);
    expect(otherWorkspaceError).toBeInstanceOf(NotFoundError);
    expect((otherWorkspaceError as NotFoundError).message).toBe(
      (ownWorkspaceError as NotFoundError).message,
    );
    expect((otherWorkspaceError as NotFoundError).statusCode).toBe(
      (ownWorkspaceError as NotFoundError).statusCode,
    );
    expect((otherWorkspaceError as NotFoundError).code).toBe(
      (ownWorkspaceError as NotFoundError).code,
    );
  });

  it('throws ServiceValidationError when id does not look like an id', async () => {
    await expect(
      service.run({ id: 'not-an-id' }, buildContext(ACTIVE_CALLER)),
    ).rejects.toBeInstanceOf(ServiceValidationError);
  });

  it('throws AuthenticationError for a non-active caller', async () => {
    await expect(
      service.run({ id: TX_ID }, buildContext(PENDING_CALLER)),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('throws AuthenticationError when there is no caller at all', async () => {
    await expect(
      service.run({ id: TX_ID }, buildContext(null)),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });
});
