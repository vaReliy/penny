import { AuthenticationError } from 'shared-errors';
import { Money } from 'shared-util';
import { MonthlyBudget } from 'budget-core';
import { UserStatus } from 'shared-contracts';
import { ServiceValidationError } from 'shared-kernel';
import type { IMonthlyBudgetRepository } from 'budget-core';
import type { CallerIdentity, ServiceContext } from 'shared-kernel';
import { beforeEach, describe, expect, it } from 'vitest';

import { ListMonthlyBudgetsService } from './list-monthly-budgets.service.js';
import type { BudgetServiceConfig } from './budget-service-config.js';

/** In-memory `IMonthlyBudgetRepository` fake. */
class FakeMonthlyBudgetRepository implements IMonthlyBudgetRepository {
  private readonly budgets: MonthlyBudget[] = [];

  public seed(budget: MonthlyBudget): void {
    this.budgets.push(budget);
  }

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
    this.budgets.push(
      MonthlyBudget.create(
        `budget-${this.budgets.length + 1}`,
        workspaceId,
        categoryId,
        month,
        amount,
      ),
    );
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

describe('ListMonthlyBudgetsService', () => {
  let repository: FakeMonthlyBudgetRepository;
  let service: ListMonthlyBudgetsService;

  beforeEach(() => {
    repository = new FakeMonthlyBudgetRepository();
    service = new ListMonthlyBudgetsService({
      monthlyBudgetRepository: repository,
    });
  });

  it('lists budgets for the requested month, scoped to the workspace', async () => {
    repository.seed(
      MonthlyBudget.create(
        'budget-1',
        'ws-1',
        '507f1f77bcf86cd799439011',
        '2026-07',
        Money.fromMinorUnits(10_000, 'UAH'),
      ),
    );
    repository.seed(
      MonthlyBudget.create(
        'budget-2',
        'ws-1',
        '507f1f77bcf86cd799439012',
        '2026-08',
        Money.fromMinorUnits(20_000, 'UAH'),
      ),
    );
    repository.seed(
      MonthlyBudget.create(
        'budget-3',
        'ws-other',
        '507f1f77bcf86cd799439013',
        '2026-07',
        Money.fromMinorUnits(30_000, 'UAH'),
      ),
    );

    const outcome = await service.run(
      { month: '2026-07' },
      buildContext(ACTIVE_CALLER),
    );

    expect(outcome.data).toHaveLength(1);
    expect(outcome.data[0]?.id).toBe('budget-1');
  });

  it('returns an empty list when no budget exists for the month', async () => {
    const outcome = await service.run(
      { month: '2026-07' },
      buildContext(ACTIVE_CALLER),
    );

    expect(outcome.data).toEqual([]);
  });

  it('throws ServiceValidationError when month is not YYYY-MM', async () => {
    await expect(
      service.run({ month: 'not-a-month' }, buildContext(ACTIVE_CALLER)),
    ).rejects.toBeInstanceOf(ServiceValidationError);
  });

  it('throws AuthenticationError for a non-active caller', async () => {
    await expect(
      service.run({ month: '2026-07' }, buildContext(PENDING_CALLER)),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('throws AuthenticationError when there is no caller at all', async () => {
    await expect(
      service.run({ month: '2026-07' }, buildContext(null)),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });
});
