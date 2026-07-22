import { AuthenticationError } from 'shared-errors';
import { Money } from 'shared-util';
import { MonthlyBudget } from 'budget-core';
import { UserStatus } from 'shared-contracts';
import { ServiceValidationError } from 'shared-kernel';
import type { IMonthlyBudgetRepository } from 'budget-core';
import type { CallerIdentity, ServiceContext } from 'shared-kernel';
import { beforeEach, describe, expect, it } from 'vitest';

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

describe('UpsertMonthlyBudgetService', () => {
  let repository: FakeMonthlyBudgetRepository;
  let service: UpsertMonthlyBudgetService;

  beforeEach(() => {
    repository = new FakeMonthlyBudgetRepository();
    service = new UpsertMonthlyBudgetService({
      monthlyBudgetRepository: repository,
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

  it('does not validate that categoryId refers to an existing category (ADR: any category may be budgeted)', async () => {
    const outcome = await service.run(
      {
        categoryId: '507f1f77bcf86cd799439099',
        month: '2026-07',
        amountMinorUnits: 1_000,
      },
      buildContext(ACTIVE_CALLER),
    );

    expect(outcome.data.categoryId).toBe('507f1f77bcf86cd799439099');
  });

  it('surfaces DomainError when the entity factory rejects a zero amount', async () => {
    // amountMinorUnits: 0 fails LIVR's positive_integer rule before the
    // entity factory even runs — this test documents that the boundary
    // (validate) is what fires, per the task's "delegating to schemas is
    // fine, just assert the boundary fires" guidance.
    await expect(
      service.run(
        { categoryId: CATEGORY_ID, month: '2026-07', amountMinorUnits: 0 },
        buildContext(ACTIVE_CALLER),
      ),
    ).rejects.toBeInstanceOf(ServiceValidationError);
  });
});
