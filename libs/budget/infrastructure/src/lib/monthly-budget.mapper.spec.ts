import type { DocumentType } from '@typegoose/typegoose';
import { describe, expect, it } from 'vitest';

import { MonthlyBudget } from 'budget-core';
import { Money } from 'shared-util';

import { MonthlyBudgetMapper } from './monthly-budget.mapper.js';
import type { MonthlyBudgetModel } from './monthly-budget.model.js';

/** Minimal hydrated-document shape `MonthlyBudgetMapper.toDomain` reads from. */
function buildDoc(
  amount: bigint,
  currency = 'UAH',
): DocumentType<MonthlyBudgetModel> {
  return {
    _id: { toString: () => '507f1f77bcf86cd799439011' },
    workspaceId: 'ws-1',
    categoryId: 'cat-1',
    month: '2026-07',
    amount,
    currency,
  } as unknown as DocumentType<MonthlyBudgetModel>;
}

describe('MonthlyBudgetMapper', () => {
  describe('toDomain', () => {
    it('maps a document to a domain MonthlyBudget, recombining amount+currency into Money', () => {
      const budget = MonthlyBudgetMapper.toDomain(buildDoc(150000n));

      expect(budget).toBeInstanceOf(MonthlyBudget);
      expect(budget.id).toBe('507f1f77bcf86cd799439011');
      expect(budget.workspaceId).toBe('ws-1');
      expect(budget.categoryId).toBe('cat-1');
      expect(budget.month).toBe('2026-07');
      expect(budget.amount.amount).toBe(150000n);
      expect(budget.amount.currency).toBe('UAH');
    });

    it('round-trips a large minor-units amount exactly (no float precision loss)', () => {
      // Larger than Number.MAX_SAFE_INTEGER-adjacent magnitudes some
      // currencies could realistically reach in minor units.
      const largeAmount = 9007199254740993n; // 2^53 + 1
      const budget = MonthlyBudgetMapper.toDomain(buildDoc(largeAmount));

      expect(budget.amount.amount).toBe(largeAmount);
    });
  });

  describe('toPersistence', () => {
    it('splits Money into separate amount/currency persistence fields', () => {
      const amount = Money.fromMinorUnits(250000n, 'UAH');
      const budget = MonthlyBudget.create(
        'budget-1',
        'ws-1',
        'cat-1',
        '2026-07',
        amount,
      );

      const persistence = MonthlyBudgetMapper.toPersistence(budget);

      expect(persistence).toEqual({
        workspaceId: 'ws-1',
        categoryId: 'cat-1',
        month: '2026-07',
        amount: 250000n,
        currency: 'UAH',
      });
    });
  });
});
