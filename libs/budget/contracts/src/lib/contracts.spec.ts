import { describe, expect, it } from 'vitest';

import { DEFAULT_WORKSPACE_ID, TransactionType } from '../index.js';
import type {
  BalanceResponse,
  CategoryResponse,
  CreateTransactionRequest,
  MonthlyBudgetResponse,
  PlannerSummaryResponse,
} from '../index.js';

describe('TransactionType', () => {
  it('TransactionType.INCOME serialises to the string "income"', () => {
    expect(TransactionType.INCOME).toBe('income');
  });

  it('TransactionType.EXPENSE serialises to the string "expense"', () => {
    expect(TransactionType.EXPENSE).toBe('expense');
  });

  it('has exactly two members — no undocumented types', () => {
    expect(Object.keys(TransactionType)).toStrictEqual(['INCOME', 'EXPENSE']);
  });
});

describe('DEFAULT_WORKSPACE_ID', () => {
  it('is a non-empty string constant', () => {
    expect(typeof DEFAULT_WORKSPACE_ID).toBe('string');
    expect(DEFAULT_WORKSPACE_ID.length).toBeGreaterThan(0);
  });
});

describe('budget contracts (types-only smoke check)', () => {
  it('allows constructing a value that satisfies CreateTransactionRequest', () => {
    const request: CreateTransactionRequest = {
      accountId: 'acc-1',
      categoryId: 'cat-1',
      type: TransactionType.EXPENSE,
      amountMinorUnits: 1_500,
      date: '2026-07-20',
    };

    expect(request.type).toBe('expense');
  });

  it('allows constructing a value that satisfies CategoryResponse', () => {
    const category: CategoryResponse = { id: 'cat-1', name: 'Groceries' };

    expect(category.archivedAt).toBeUndefined();
  });

  it('allows constructing a value that satisfies MonthlyBudgetResponse', () => {
    const budget: MonthlyBudgetResponse = {
      id: 'mb-1',
      categoryId: 'cat-1',
      month: '2026-07',
      amount: { amount: '5000', currency: 'UAH' },
    };

    expect(budget.month).toBe('2026-07');
  });

  it('allows constructing a value that satisfies BalanceResponse', () => {
    const balance: BalanceResponse = {
      accountId: 'acc-1',
      balance: { amount: '10000', currency: 'UAH' },
    };

    expect(balance.accountId).toBe('acc-1');
  });

  it('allows constructing a value that satisfies PlannerSummaryResponse', () => {
    const summary: PlannerSummaryResponse = {
      month: '2026-07',
      categories: [
        {
          categoryId: 'cat-1',
          budgeted: { amount: '5000', currency: 'UAH' },
          spent: { amount: '1500', currency: 'UAH' },
          remaining: { amount: '3500', currency: 'UAH' },
        },
      ],
    };

    expect(summary.categories).toHaveLength(1);
  });
});
