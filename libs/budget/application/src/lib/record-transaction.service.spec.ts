import { AuthenticationError } from 'shared-errors';
import { Category, Transaction } from 'budget-core';
import { UserStatus } from 'shared-contracts';
import { ServiceValidationError } from 'shared-kernel';
import type {
  ICategoryRepository,
  ITransactionRepository,
  TransactionTypeTotals,
  CategoryExpenseTotal,
} from 'budget-core';
import type { CallerIdentity, ServiceContext } from 'shared-kernel';
import { beforeEach, describe, expect, it } from 'vitest';

import { RecordTransactionService } from './record-transaction.service.js';
import { CategoryNotEligibleError } from './category-not-eligible-error.js';
import type { BudgetServiceConfig } from './budget-service-config.js';

/** In-memory `ICategoryRepository` fake, keyed by `id`. */
class FakeCategoryRepository implements ICategoryRepository {
  private readonly categoriesById = new Map<string, Category>();

  public seed(category: Category): void {
    this.categoriesById.set(category.id, category);
  }

  public async findById(id: string): Promise<Category | null> {
    return this.categoriesById.get(id) ?? null;
  }

  public async findByWorkspace(workspaceId: string): Promise<Category[]> {
    return [...this.categoriesById.values()].filter(
      (category) => category.workspaceId === workspaceId,
    );
  }

  public async findByIdInWorkspace(
    id: string,
    workspaceId: string,
  ): Promise<Category | null> {
    const category = this.categoriesById.get(id);
    return category && category.workspaceId === workspaceId ? category : null;
  }

  public async findByNameInWorkspace(): Promise<Category | null> {
    return null;
  }

  public async archive(): Promise<void> {
    // Unused by this suite.
  }

  public async save(entity: Category): Promise<Category> {
    this.categoriesById.set(entity.id, entity);
    return entity;
  }

  public async delete(id: string): Promise<void> {
    this.categoriesById.delete(id);
  }
}

/** In-memory `ITransactionRepository` fake, keyed by `id`. */
class FakeTransactionRepository implements ITransactionRepository {
  public readonly saved: Transaction[] = [];
  private readonly byId = new Map<string, Transaction>();
  private nextId = 1;

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
    // Unused by this suite (Q5 edit phase).
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
    const id = entity.id || `tx-${this.nextId++}`;
    const persisted =
      id === entity.id
        ? entity
        : Transaction.create(
            id,
            entity.workspaceId,
            entity.accountId,
            entity.categoryId,
            entity.type,
            entity.amount,
            entity.date,
            entity.createdBy,
            entity.description,
            entity.createdAt,
          );
    this.byId.set(id, persisted);
    this.saved.push(persisted);
    return persisted;
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

const CATEGORY_ID = '507f1f77bcf86cd799439011';
const ACCOUNT_ID = '507f1f77bcf86cd799439022';
const UNKNOWN_CATEGORY_ID = '507f1f77bcf86cd799439099';

const VALID_PARAMS = {
  accountId: ACCOUNT_ID,
  categoryId: CATEGORY_ID,
  type: 'expense' as const,
  amountMinorUnits: 1_500,
  date: '2026-07-20',
  description: 'Groceries',
};

describe('RecordTransactionService', () => {
  let categoryRepository: FakeCategoryRepository;
  let transactionRepository: FakeTransactionRepository;
  let service: RecordTransactionService;

  beforeEach(() => {
    categoryRepository = new FakeCategoryRepository();
    transactionRepository = new FakeTransactionRepository();
    service = new RecordTransactionService({
      categoryRepository,
      transactionRepository,
    });
    categoryRepository.seed(Category.create(CATEGORY_ID, 'ws-1', 'Groceries'));
  });

  it('records an expense transaction in the caller workspace', async () => {
    const outcome = await service.run(
      VALID_PARAMS,
      buildContext(ACTIVE_CALLER),
    );

    expect(outcome.data.workspaceId).toBe('ws-1');
    expect(outcome.data.type).toBe('expense');
    expect(outcome.data.amount.amount).toBe(1_500n);
    expect(outcome.data.id).not.toBe('');
  });

  it('records an income transaction in the caller workspace', async () => {
    const outcome = await service.run(
      { ...VALID_PARAMS, type: 'income' },
      buildContext(ACTIVE_CALLER),
    );

    expect(outcome.data.type).toBe('income');
  });

  it('stamps createdBy from the caller identity, never from params', async () => {
    const outcome = await service.run(
      {
        ...VALID_PARAMS,
        ...({ createdBy: 'attacker' } as Record<string, unknown>),
      },
      buildContext(ACTIVE_CALLER),
    );

    expect(outcome.data.createdBy).toBe('user-1');
  });

  it('never writes a stored balance field: persisted entity carries no balance/amount side-effect on Category', async () => {
    await service.run(VALID_PARAMS, buildContext(ACTIVE_CALLER));

    // The only mutation performed is a single Transaction insert; Category
    // is read-only through this flow (fake has no balance field to mutate).
    expect(transactionRepository.saved).toHaveLength(1);
    const persistedCategory = await categoryRepository.findByIdInWorkspace(
      CATEGORY_ID,
      'ws-1',
    );
    expect(persistedCategory?.name).toBe('Groceries');
  });

  it('throws ServiceValidationError when required fields are missing', async () => {
    await expect(
      service.run(
        { ...VALID_PARAMS, amountMinorUnits: undefined as unknown as number },
        buildContext(ACTIVE_CALLER),
      ),
    ).rejects.toBeInstanceOf(ServiceValidationError);
  });

  it('throws ServiceValidationError on a non-integer (float) amount', async () => {
    await expect(
      service.run(
        { ...VALID_PARAMS, amountMinorUnits: 12.5 },
        buildContext(ACTIVE_CALLER),
      ),
    ).rejects.toBeInstanceOf(ServiceValidationError);
  });

  it('throws AuthenticationError for a non-active caller', async () => {
    await expect(
      service.run(VALID_PARAMS, buildContext(PENDING_CALLER)),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('throws AuthenticationError when there is no caller at all', async () => {
    await expect(
      service.run(VALID_PARAMS, buildContext(null)),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('throws CategoryNotEligibleError when categoryId does not exist', async () => {
    await expect(
      service.run(
        { ...VALID_PARAMS, categoryId: UNKNOWN_CATEGORY_ID },
        buildContext(ACTIVE_CALLER),
      ),
    ).rejects.toBeInstanceOf(CategoryNotEligibleError);
  });

  it('throws CategoryNotEligibleError when categoryId belongs to a different workspace', async () => {
    const otherWorkspaceCategoryId = '507f1f77bcf86cd799439055';
    categoryRepository.seed(
      Category.create(otherWorkspaceCategoryId, 'ws-other', 'Rent'),
    );

    await expect(
      service.run(
        { ...VALID_PARAMS, categoryId: otherWorkspaceCategoryId },
        buildContext(ACTIVE_CALLER),
      ),
    ).rejects.toBeInstanceOf(CategoryNotEligibleError);
  });

  it('throws CategoryNotEligibleError when the category is archived', async () => {
    categoryRepository.seed(
      Category.create(CATEGORY_ID, 'ws-1', 'Groceries').archive(new Date()),
    );

    await expect(
      service.run(VALID_PARAMS, buildContext(ACTIVE_CALLER)),
    ).rejects.toBeInstanceOf(CategoryNotEligibleError);
  });

  it('does not persist a transaction when the category check fails', async () => {
    await service
      .run(
        { ...VALID_PARAMS, categoryId: UNKNOWN_CATEGORY_ID },
        buildContext(ACTIVE_CALLER),
      )
      .catch(() => undefined);

    expect(transactionRepository.saved).toHaveLength(0);
  });
});
