import { AuthenticationError } from 'shared-errors';
import { Money } from 'shared-util';
import { MonthlyBudget } from 'budget-core';
import { UserStatus } from 'shared-contracts';
import { ServiceValidationError } from 'shared-kernel';
import type {
  CategoryExpenseTotal,
  IMonthlyBudgetRepository,
  ITransactionRepository,
  TransactionAggregationFilter,
  TransactionTypeTotals,
} from 'budget-core';
import type { CallerIdentity, ServiceContext } from 'shared-kernel';
import { beforeEach, describe, expect, it } from 'vitest';

import { GetPlannerSummaryService } from './get-planner-summary.service.js';
import type { BudgetServiceConfig } from './budget-service-config.js';

/** In-memory `IMonthlyBudgetRepository` fake, keyed by `id`. */
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

  public async findByWorkspaceCategoryMonth(): Promise<MonthlyBudget | null> {
    return null;
  }

  public async upsertAmount(): Promise<void> {
    // Unused by this suite.
  }

  public async save(entity: MonthlyBudget): Promise<MonthlyBudget> {
    this.budgets.push(entity);
    return entity;
  }

  public async delete(): Promise<void> {
    // Unused by this suite.
  }
}

/** In-memory `ITransactionRepository` fake exposing only the aggregation methods this suite needs. */
class FakeTransactionRepository implements ITransactionRepository {
  public lastCategoryFilter:
    | Pick<TransactionAggregationFilter, 'from' | 'to'>
    | undefined;
  private categoryTotals: CategoryExpenseTotal[] = [];
  private readonly transactions: {
    categoryId: string;
    amount: bigint;
    date: Date;
  }[] = [];

  public setCategoryTotals(totals: CategoryExpenseTotal[]): void {
    this.categoryTotals = totals;
  }

  /** Seeds a raw dated expense; {@link sumExpenseByCategory} attributes it to whichever month range it falls within, per the `[from, to)` half-open contract. */
  public seedTransaction(categoryId: string, amount: bigint, date: Date): void {
    this.transactions.push({ categoryId, amount, date });
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

    if (this.transactions.length === 0) {
      return this.categoryTotals;
    }

    const totalsByCategory = new Map<string, bigint>();
    for (const transaction of this.transactions) {
      const afterFrom = !filter?.from || transaction.date >= filter.from;
      const beforeTo = !filter?.to || transaction.date < filter.to;
      if (afterFrom && beforeTo) {
        totalsByCategory.set(
          transaction.categoryId,
          (totalsByCategory.get(transaction.categoryId) ?? 0n) +
            transaction.amount,
        );
      }
    }

    return [...totalsByCategory.entries()].map(([categoryId, total]) => ({
      categoryId,
      total,
    }));
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

const CATEGORY_BUDGETED_AND_SPENT = 'cat-both';
const CATEGORY_BUDGET_NO_SPEND = 'cat-budget-only';
const CATEGORY_SPEND_NO_BUDGET = 'cat-spend-only';

describe('GetPlannerSummaryService', () => {
  let monthlyBudgetRepository: FakeMonthlyBudgetRepository;
  let transactionRepository: FakeTransactionRepository;
  let service: GetPlannerSummaryService;

  beforeEach(() => {
    monthlyBudgetRepository = new FakeMonthlyBudgetRepository();
    transactionRepository = new FakeTransactionRepository();
    service = new GetPlannerSummaryService({
      monthlyBudgetRepository,
      transactionRepository,
    });
  });

  it('computes budgeted/spent/remaining/percent for a category with both a budget and spend', async () => {
    monthlyBudgetRepository.seed(
      MonthlyBudget.create(
        'mb-1',
        'ws-1',
        CATEGORY_BUDGETED_AND_SPENT,
        '2026-07',
        Money.fromMinorUnits(10_000, 'UAH'),
      ),
    );
    transactionRepository.setCategoryTotals([
      { categoryId: CATEGORY_BUDGETED_AND_SPENT, total: 2_500n },
    ]);

    const outcome = await service.run(
      { month: '2026-07' },
      buildContext(ACTIVE_CALLER),
    );

    expect(outcome.data.categories).toHaveLength(1);
    const summary = outcome.data.categories[0];
    expect(summary?.categoryId).toBe(CATEGORY_BUDGETED_AND_SPENT);
    expect(summary?.budgeted.amount).toBe(10_000n);
    expect(summary?.spent.amount).toBe(2_500n);
    expect(summary?.remaining.amount).toBe(7_500n);
    expect(summary?.percent).toBe(25);
  });

  it('union semantics: a category with a budget but no spend appears with spent: 0', async () => {
    monthlyBudgetRepository.seed(
      MonthlyBudget.create(
        'mb-1',
        'ws-1',
        CATEGORY_BUDGET_NO_SPEND,
        '2026-07',
        Money.fromMinorUnits(5_000, 'UAH'),
      ),
    );
    transactionRepository.setCategoryTotals([]);

    const outcome = await service.run(
      { month: '2026-07' },
      buildContext(ACTIVE_CALLER),
    );

    expect(outcome.data.categories).toHaveLength(1);
    const summary = outcome.data.categories[0];
    expect(summary?.spent.isZero()).toBe(true);
    expect(summary?.remaining.amount).toBe(5_000n);
    expect(summary?.percent).toBe(0);
  });

  it('union semantics: a category with spend but no budget appears with budgeted: 0 and negative remaining', async () => {
    transactionRepository.setCategoryTotals([
      { categoryId: CATEGORY_SPEND_NO_BUDGET, total: 3_000n },
    ]);

    const outcome = await service.run(
      { month: '2026-07' },
      buildContext(ACTIVE_CALLER),
    );

    expect(outcome.data.categories).toHaveLength(1);
    const summary = outcome.data.categories[0];
    expect(summary?.budgeted.isZero()).toBe(true);
    expect(summary?.remaining.amount).toBe(-3_000n);
    // Zero-budget division must not throw or produce NaN.
    expect(summary?.percent).toBe(0);
    expect(Number.isNaN(summary?.percent)).toBe(false);
  });

  it('returns no categories when there is neither a budget nor spend', async () => {
    const outcome = await service.run(
      { month: '2026-07' },
      buildContext(ACTIVE_CALLER),
    );

    expect(outcome.data.categories).toHaveLength(0);
  });

  it('rounds percent to the nearest whole number using integer bigint math', async () => {
    monthlyBudgetRepository.seed(
      MonthlyBudget.create(
        'mb-1',
        'ws-1',
        CATEGORY_BUDGETED_AND_SPENT,
        '2026-07',
        Money.fromMinorUnits(3, 'UAH'),
      ),
    );
    transactionRepository.setCategoryTotals([
      { categoryId: CATEGORY_BUDGETED_AND_SPENT, total: 1n },
    ]);

    const outcome = await service.run(
      { month: '2026-07' },
      buildContext(ACTIVE_CALLER),
    );

    // 1/3 * 100 = 33.33... rounds to 33, never a float in the computation.
    expect(outcome.data.categories[0]?.percent).toBe(33);
  });

  it('sorts multiple categories by categoryId (deterministic ordering)', async () => {
    monthlyBudgetRepository.seed(
      MonthlyBudget.create(
        'mb-1',
        'ws-1',
        CATEGORY_SPEND_NO_BUDGET,
        '2026-07',
        Money.fromMinorUnits(1_000, 'UAH'),
      ),
    );
    monthlyBudgetRepository.seed(
      MonthlyBudget.create(
        'mb-2',
        'ws-1',
        CATEGORY_BUDGETED_AND_SPENT,
        '2026-07',
        Money.fromMinorUnits(2_000, 'UAH'),
      ),
    );
    monthlyBudgetRepository.seed(
      MonthlyBudget.create(
        'mb-3',
        'ws-1',
        CATEGORY_BUDGET_NO_SPEND,
        '2026-07',
        Money.fromMinorUnits(3_000, 'UAH'),
      ),
    );

    const outcome = await service.run(
      { month: '2026-07' },
      buildContext(ACTIVE_CALLER),
    );

    expect(
      outcome.data.categories.map((category) => category.categoryId),
    ).toEqual(
      [
        CATEGORY_BUDGETED_AND_SPENT,
        CATEGORY_BUDGET_NO_SPEND,
        CATEGORY_SPEND_NO_BUDGET,
      ]
        .slice()
        .sort((a, b) => a.localeCompare(b)),
    );
  });

  it('resolves the month filter to a Europe/Kyiv instant range passed to the repository', async () => {
    await service.run({ month: '2026-07' }, buildContext(ACTIVE_CALLER));

    expect(transactionRepository.lastCategoryFilter?.from?.toISOString()).toBe(
      '2026-06-30T21:00:00.000Z',
    );
    expect(transactionRepository.lastCategoryFilter?.to?.toISOString()).toBe(
      '2026-07-31T21:00:00.000Z',
    );
  });

  it('attributes an expense at 01:00 Kyiv on 1 July to 2026-07, not 2026-06', async () => {
    transactionRepository.seedTransaction(
      CATEGORY_SPEND_NO_BUDGET,
      1_000n,
      new Date('2026-06-30T22:00:00.000Z'),
    );

    const julyOutcome = await service.run(
      { month: '2026-07' },
      buildContext(ACTIVE_CALLER),
    );
    const juneOutcome = await service.run(
      { month: '2026-06' },
      buildContext(ACTIVE_CALLER),
    );

    expect(julyOutcome.data.categories).toHaveLength(1);
    expect(julyOutcome.data.categories[0]?.spent.amount).toBe(1_000n);
    expect(juneOutcome.data.categories).toHaveLength(0);
  });

  it('attributes an expense at 00:30 Kyiv on 1 August to 2026-08, not 2026-07', async () => {
    transactionRepository.seedTransaction(
      CATEGORY_SPEND_NO_BUDGET,
      1_000n,
      new Date('2026-07-31T21:30:00.000Z'),
    );

    const julyOutcome = await service.run(
      { month: '2026-07' },
      buildContext(ACTIVE_CALLER),
    );
    const augustOutcome = await service.run(
      { month: '2026-08' },
      buildContext(ACTIVE_CALLER),
    );

    expect(julyOutcome.data.categories).toHaveLength(0);
    expect(augustOutcome.data.categories).toHaveLength(1);
    expect(augustOutcome.data.categories[0]?.spent.amount).toBe(1_000n);
  });

  it('half-open range: an expense exactly at the month start instant is included, exactly at the end instant is excluded', async () => {
    transactionRepository.seedTransaction(
      CATEGORY_SPEND_NO_BUDGET,
      1_000n,
      new Date('2026-06-30T21:00:00.000Z'),
    );
    transactionRepository.seedTransaction(
      CATEGORY_BUDGETED_AND_SPENT,
      2_000n,
      new Date('2026-07-31T21:00:00.000Z'),
    );

    const outcome = await service.run(
      { month: '2026-07' },
      buildContext(ACTIVE_CALLER),
    );

    const categoryIds = outcome.data.categories.map(
      (category) => category.categoryId,
    );
    expect(categoryIds).toContain(CATEGORY_SPEND_NO_BUDGET);
    expect(categoryIds).not.toContain(CATEGORY_BUDGETED_AND_SPENT);
  });

  it('throws ServiceValidationError for a malformed month', async () => {
    await expect(
      service.run({ month: '2026-13' }, buildContext(ACTIVE_CALLER)),
    ).rejects.toBeInstanceOf(ServiceValidationError);
  });

  it('throws AuthenticationError for a non-active caller', async () => {
    await expect(
      service.run({ month: '2026-07' }, buildContext(PENDING_CALLER)),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });
});
