import { AuthenticationError } from 'shared-errors';
import { Category } from 'budget-core';
import { UserStatus } from 'shared-contracts';
import { ServiceValidationError } from 'shared-kernel';
import type {
  CategoryExpenseTotal,
  ICategoryRepository,
  ITransactionRepository,
  TransactionAggregationFilter,
  TransactionTypeTotals,
} from 'budget-core';
import type { CallerIdentity, ServiceContext } from 'shared-kernel';
import { beforeEach, describe, expect, it } from 'vitest';

import { GetHistoryChartService } from './get-history-chart.service.js';
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

  public async findByWorkspace(
    workspaceId: string,
    includeArchived = false,
  ): Promise<Category[]> {
    return [...this.categoriesById.values()].filter(
      (category) =>
        category.workspaceId === workspaceId &&
        (includeArchived || !category.isArchived()),
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

/** In-memory `ITransactionRepository` fake exposing only the aggregation methods this suite needs. */
class FakeTransactionRepository implements ITransactionRepository {
  public lastCategoryFilter:
    | Pick<TransactionAggregationFilter, 'from' | 'to'>
    | undefined;
  private categoryTotals: CategoryExpenseTotal[] = [];

  public setCategoryTotals(totals: CategoryExpenseTotal[]): void {
    this.categoryTotals = totals;
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

  public async sumAmountsByType(): Promise<TransactionTypeTotals> {
    return { income: 0n, expense: 0n };
  }

  public async sumExpenseByCategory(
    _workspaceId: string,
    filter?: Pick<TransactionAggregationFilter, 'from' | 'to'>,
  ): Promise<CategoryExpenseTotal[]> {
    this.lastCategoryFilter = filter;
    return this.categoryTotals;
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

const GROCERIES_ID = '507f1f77bcf86cd799439011';
const RENT_ID = '507f1f77bcf86cd799439022';
const ARCHIVED_ID = '507f1f77bcf86cd799439033';

describe('GetHistoryChartService', () => {
  let categoryRepository: FakeCategoryRepository;
  let transactionRepository: FakeTransactionRepository;
  let service: GetHistoryChartService;

  beforeEach(() => {
    categoryRepository = new FakeCategoryRepository();
    transactionRepository = new FakeTransactionRepository();
    service = new GetHistoryChartService({
      transactionRepository,
      categoryRepository,
    });
    categoryRepository.seed(Category.create(GROCERIES_ID, 'ws-1', 'Groceries'));
    categoryRepository.seed(Category.create(RENT_ID, 'ws-1', 'Rent'));
  });

  it('joins category names onto the repository aggregation, sorted by value descending', async () => {
    transactionRepository.setCategoryTotals([
      { categoryId: RENT_ID, total: 12_000n },
      { categoryId: GROCERIES_ID, total: 3_000n },
    ]);

    const outcome = await service.run(
      { month: '2026-07' },
      buildContext(ACTIVE_CALLER),
    );

    expect(outcome.data).toEqual([
      {
        categoryId: RENT_ID,
        name: 'Rent',
        value: expect.objectContaining({ amount: 12_000n }),
      },
      {
        categoryId: GROCERIES_ID,
        name: 'Groceries',
        value: expect.objectContaining({ amount: 3_000n }),
      },
    ]);
  });

  it('includes archived categories (aggregation covers archived spend per ADR)', async () => {
    categoryRepository.seed(
      Category.create(ARCHIVED_ID, 'ws-1', 'Old Subscriptions').archive(
        new Date(),
      ),
    );
    transactionRepository.setCategoryTotals([
      { categoryId: ARCHIVED_ID, total: 500n },
    ]);

    const outcome = await service.run({}, buildContext(ACTIVE_CALLER));

    expect(outcome.data).toEqual([
      expect.objectContaining({
        categoryId: ARCHIVED_ID,
        name: 'Old Subscriptions',
      }),
    ]);
  });

  it('falls back to a placeholder name when a categoryId cannot be resolved', async () => {
    transactionRepository.setCategoryTotals([
      { categoryId: 'ghost-category', total: 100n },
    ]);

    const outcome = await service.run({}, buildContext(ACTIVE_CALLER));

    expect(outcome.data[0]?.name).toBe('Unknown category');
  });

  it('reorders ascending-supplied totals into descending output (proves the sort actually reorders, not just preserves input order)', async () => {
    transactionRepository.setCategoryTotals([
      { categoryId: GROCERIES_ID, total: 3_000n },
      { categoryId: RENT_ID, total: 12_000n },
    ]);

    const outcome = await service.run(
      { month: '2026-07' },
      buildContext(ACTIVE_CALLER),
    );

    expect(outcome.data).toEqual([
      expect.objectContaining({ categoryId: RENT_ID }),
      expect.objectContaining({ categoryId: GROCERIES_ID }),
    ]);
  });

  it('keeps a defined (non-throwing) order when two categories tie on value', async () => {
    transactionRepository.setCategoryTotals([
      { categoryId: RENT_ID, total: 5_000n },
      { categoryId: GROCERIES_ID, total: 5_000n },
    ]);

    const outcome = await service.run(
      { month: '2026-07' },
      buildContext(ACTIVE_CALLER),
    );

    expect(outcome.data).toHaveLength(2);
    expect(outcome.data.every((entry) => entry.value.amount === 5_000n)).toBe(
      true,
    );
    expect(new Set(outcome.data.map((entry) => entry.categoryId))).toEqual(
      new Set([RENT_ID, GROCERIES_ID]),
    );
  });

  it('returns an empty array when there is no expense in the period', async () => {
    const outcome = await service.run(
      { month: '2026-07' },
      buildContext(ACTIVE_CALLER),
    );

    expect(outcome.data).toEqual([]);
  });

  it('resolves month to a Europe/Kyiv instant range, taking precedence over from/to', async () => {
    await service.run(
      { month: '2026-07', from: '2020-01-01', to: '2020-01-31' },
      buildContext(ACTIVE_CALLER),
    );

    const filter = transactionRepository.lastCategoryFilter;
    expect(filter?.from).toBeInstanceOf(Date);
    expect(filter?.from?.getUTCFullYear()).toBe(2026);
  });

  it('passes an explicit from/to range through when no month is given', async () => {
    await service.run(
      { from: '2026-07-01', to: '2026-07-31' },
      buildContext(ACTIVE_CALLER),
    );

    const filter = transactionRepository.lastCategoryFilter;
    expect(filter?.from).toEqual(new Date('2026-07-01'));
    expect(filter?.to).toEqual(new Date('2026-07-31'));
  });

  it('allows an unbounded (all-time) query — no period is mandatory', async () => {
    await expect(
      service.run({}, buildContext(ACTIVE_CALLER)),
    ).resolves.toBeDefined();
    expect(transactionRepository.lastCategoryFilter).toEqual({
      from: undefined,
      to: undefined,
    });
  });

  it('throws ServiceValidationError for a malformed month', async () => {
    await expect(
      service.run({ month: '2026-13' }, buildContext(ACTIVE_CALLER)),
    ).rejects.toBeInstanceOf(ServiceValidationError);
  });

  it('throws AuthenticationError for a non-active caller', async () => {
    await expect(
      service.run({}, buildContext(PENDING_CALLER)),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });
});
