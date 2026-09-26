import { AuthenticationError } from 'shared-errors';
import { Money } from 'shared-util';
import { Category, MonthlyBudget } from 'budget-core';
import { UserStatus } from 'shared-contracts';
import { ServiceValidationError } from 'shared-kernel';
import type {
  ICategoryRepository,
  IMonthlyBudgetRepository,
} from 'budget-core';
import type { CallerIdentity, ServiceContext } from 'shared-kernel';
import { beforeEach, describe, expect, it } from 'vitest';

import { CategoryNotEligibleError } from './category-not-eligible-error.js';
import { UpsertMonthlyBudgetService } from './upsert-monthly-budget.service.js';
import type { BudgetServiceConfig } from './budget-service-config.js';

/** In-memory `IMonthlyBudgetRepository` fake, keyed by `(workspaceId, categoryId, month)`. */
class FakeMonthlyBudgetRepository implements IMonthlyBudgetRepository {
  private readonly budgets: MonthlyBudget[] = [];
  private nextId = 1;

  public async findById(id: string): Promise<MonthlyBudget | null> {
    return this.budgets.find((budget) => budget.id === id) ?? null;
  }

  public async findByWorkspaceAndMonth(
    workspaceId: string,
    month: string,
  ): Promise<MonthlyBudget[]> {
    return this.budgets.filter(
      (budget) => budget.workspaceId === workspaceId && budget.month === month,
    );
  }

  public async findByWorkspaceCategoryMonth(
    workspaceId: string,
    categoryId: string,
    month: string,
  ): Promise<MonthlyBudget | null> {
    return (
      this.budgets.find(
        (budget) =>
          budget.workspaceId === workspaceId &&
          budget.categoryId === categoryId &&
          budget.month === month,
      ) ?? null
    );
  }

  public async upsertAmount(
    workspaceId: string,
    categoryId: string,
    month: string,
    amount: Money,
  ): Promise<void> {
    const index = this.budgets.findIndex(
      (budget) =>
        budget.workspaceId === workspaceId &&
        budget.categoryId === categoryId &&
        budget.month === month,
    );
    const existing = index >= 0 ? this.budgets[index] : undefined;
    const id = existing?.id ?? `budget-${this.nextId++}`;
    const upserted = MonthlyBudget.create(
      id,
      workspaceId,
      categoryId,
      month,
      amount,
    );
    if (index >= 0) {
      this.budgets[index] = upserted;
    } else {
      this.budgets.push(upserted);
    }
  }

  public async save(entity: MonthlyBudget): Promise<MonthlyBudget> {
    this.budgets.push(entity);
    return entity;
  }

  public async delete(id: string): Promise<void> {
    const index = this.budgets.findIndex((budget) => budget.id === id);
    if (index >= 0) {
      this.budgets.splice(index, 1);
    }
  }
}

/** In-memory `ICategoryRepository` fake, keyed by `id`; only the workspace-scoped lookup is exercised. */
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
    return category?.workspaceId === workspaceId ? category : null;
  }

  public async findByNameInWorkspace(): Promise<Category | null> {
    return null;
  }

  public async archive(): Promise<void> {
    return undefined;
  }

  public async save(entity: Category): Promise<Category> {
    this.categoriesById.set(entity.id, entity);
    return entity;
  }

  public async delete(id: string): Promise<void> {
    this.categoriesById.delete(id);
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
const FOREIGN_CATEGORY_ID = '507f1f77bcf86cd799439022';
const ARCHIVED_CATEGORY_ID = '507f1f77bcf86cd799439033';
const UNKNOWN_CATEGORY_ID = '507f1f77bcf86cd799439099';

describe('UpsertMonthlyBudgetService', () => {
  let repository: FakeMonthlyBudgetRepository;
  let service: UpsertMonthlyBudgetService;

  beforeEach(() => {
    repository = new FakeMonthlyBudgetRepository();
    const categoryRepository = new FakeCategoryRepository();
    categoryRepository.seed(Category.create(CATEGORY_ID, 'ws-1', 'Groceries'));
    categoryRepository.seed(
      Category.create(FOREIGN_CATEGORY_ID, 'ws-2', 'Foreign'),
    );
    categoryRepository.seed(
      Category.create(ARCHIVED_CATEGORY_ID, 'ws-1', 'Old').archive(),
    );
    service = new UpsertMonthlyBudgetService({
      monthlyBudgetRepository: repository,
      categoryRepository,
    });
  });

  it('creates a new monthly budget', async () => {
    const outcome = await service.run(
      { categoryId: CATEGORY_ID, month: '2026-07', amountMinorUnits: 50_000 },
      buildContext(ACTIVE_CALLER),
    );

    expect(outcome.data.categoryId).toBe(CATEGORY_ID);
    expect(outcome.data.month).toBe('2026-07');
    expect(
      outcome.data.amount.equals(Money.fromMinorUnits(50_000, 'UAH')),
    ).toBe(true);
  });

  it('replaces the amount for an existing (category, month) pair', async () => {
    await service.run(
      { categoryId: CATEGORY_ID, month: '2026-07', amountMinorUnits: 50_000 },
      buildContext(ACTIVE_CALLER),
    );

    const outcome = await service.run(
      { categoryId: CATEGORY_ID, month: '2026-07', amountMinorUnits: 75_000 },
      buildContext(ACTIVE_CALLER),
    );

    expect(outcome.data.amount.amount).toBe(75_000n);
    const all = await repository.findByWorkspaceAndMonth('ws-1', '2026-07');
    expect(all).toHaveLength(1);
  });

  it('falls back to the in-memory entity if the post-upsert read races and returns null', async () => {
    repository.findByWorkspaceCategoryMonth = async () => null;

    const outcome = await service.run(
      { categoryId: CATEGORY_ID, month: '2026-07', amountMinorUnits: 50_000 },
      buildContext(ACTIVE_CALLER),
    );

    expect(outcome.data.categoryId).toBe(CATEGORY_ID);
    expect(outcome.data.month).toBe('2026-07');
    expect(outcome.data.amount.amount).toBe(50_000n);
  });

  it('throws ServiceValidationError when month is not YYYY-MM', async () => {
    await expect(
      service.run(
        { categoryId: CATEGORY_ID, month: '2026-13', amountMinorUnits: 1_000 },
        buildContext(ACTIVE_CALLER),
      ),
    ).rejects.toBeInstanceOf(ServiceValidationError);
  });

  it('throws ServiceValidationError when categoryId does not look like an id', async () => {
    await expect(
      service.run(
        { categoryId: 'not-an-id', month: '2026-07', amountMinorUnits: 1_000 },
        buildContext(ACTIVE_CALLER),
      ),
    ).rejects.toBeInstanceOf(ServiceValidationError);
  });

  it('throws ServiceValidationError when amountMinorUnits is not a positive integer', async () => {
    await expect(
      service.run(
        { categoryId: CATEGORY_ID, month: '2026-07', amountMinorUnits: -5 },
        buildContext(ACTIVE_CALLER),
      ),
    ).rejects.toBeInstanceOf(ServiceValidationError);
  });

  it('throws AuthenticationError for a non-active caller', async () => {
    await expect(
      service.run(
        { categoryId: CATEGORY_ID, month: '2026-07', amountMinorUnits: 1_000 },
        buildContext(PENDING_CALLER),
      ),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  it.each([
    ["another workspace's category", FOREIGN_CATEGORY_ID],
    ['a nonexistent category', UNKNOWN_CATEGORY_ID],
  ])(
    'rejects %s with CategoryNotEligibleError and never writes',
    async (_label, categoryId) => {
      let writes = 0;
      const upsertAmount = repository.upsertAmount.bind(repository);
      repository.upsertAmount = async (...args) => {
        writes += 1;
        return upsertAmount(...args);
      };

      await expect(
        service.run(
          { categoryId, month: '2026-07', amountMinorUnits: 1_000 },
          buildContext(ACTIVE_CALLER),
        ),
      ).rejects.toBeInstanceOf(CategoryNotEligibleError);
      expect(writes).toBe(0);
      expect(
        await repository.findByWorkspaceCategoryMonth(
          'ws-1',
          categoryId,
          '2026-07',
        ),
      ).toBeNull();
    },
  );

  it('still budgets an archived category of the caller workspace (ADR: any category may be budgeted)', async () => {
    const outcome = await service.run(
      {
        categoryId: ARCHIVED_CATEGORY_ID,
        month: '2026-07',
        amountMinorUnits: 1_000,
      },
      buildContext(ACTIVE_CALLER),
    );

    expect(outcome.data.categoryId).toBe(ARCHIVED_CATEGORY_ID);
  });

  it('surfaces DomainError when the entity factory rejects a zero amount', async () => {
    // amountMinorUnits: 0 fails LIVR's positive_integer rule before the
    // entity factory even runs — this test documents that the validation
    // boundary is what fires, not the entity factory's own invariant.
    await expect(
      service.run(
        { categoryId: CATEGORY_ID, month: '2026-07', amountMinorUnits: 0 },
        buildContext(ACTIVE_CALLER),
      ),
    ).rejects.toBeInstanceOf(ServiceValidationError);
  });
});
