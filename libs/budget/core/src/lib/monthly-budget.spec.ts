import { describe, expect, it } from 'vitest';
import { Money } from 'shared-util';

import { MonthlyBudget } from './monthly-budget.js';

const AMOUNT = Money.fromMinorUnits(10_000, 'UAH');

describe('MonthlyBudget', () => {
  describe('create', () => {
    it('creates a monthly budget with the given fields', () => {
      const budget = MonthlyBudget.create(
        'mb-1',
        'ws-1',
        'cat-1',
        '2026-07',
        AMOUNT,
      );

      expect(budget.id).toBe('mb-1');
      expect(budget.workspaceId).toBe('ws-1');
      expect(budget.categoryId).toBe('cat-1');
      expect(budget.month).toBe('2026-07');
      expect(budget.amount).toBe(AMOUNT);
    });

    it('trims whitespace from workspaceId and categoryId', () => {
      const budget = MonthlyBudget.create(
        'mb-1',
        ' ws-1 ',
        ' cat-1 ',
        '2026-07',
        AMOUNT,
      );

      expect(budget.workspaceId).toBe('ws-1');
      expect(budget.categoryId).toBe('cat-1');
    });

    it('rejects a blank workspaceId', () => {
      expect(() =>
        MonthlyBudget.create('mb-1', '  ', 'cat-1', '2026-07', AMOUNT),
      ).toThrow(/workspaceId must not be blank/i);
    });

    it('rejects a blank categoryId', () => {
      expect(() =>
        MonthlyBudget.create('mb-1', 'ws-1', '  ', '2026-07', AMOUNT),
      ).toThrow(/categoryId must not be blank/i);
    });

    it.each(['2026-13', '2026-00', '2026-7', '26-07', '2026/07', ''])(
      'rejects an invalid month format: %s',
      (month) => {
        expect(() =>
          MonthlyBudget.create('mb-1', 'ws-1', 'cat-1', month, AMOUNT),
        ).toThrow(/month must be in "YYYY-MM" format/i);
      },
    );

    it('accepts every valid two-digit month', () => {
      for (const month of [
        '2026-01',
        '2026-02',
        '2026-03',
        '2026-04',
        '2026-05',
        '2026-06',
        '2026-07',
        '2026-08',
        '2026-09',
        '2026-10',
        '2026-11',
        '2026-12',
      ]) {
        expect(() =>
          MonthlyBudget.create('mb-1', 'ws-1', 'cat-1', month, AMOUNT),
        ).not.toThrow();
      }
    });

    it('rejects a zero amount', () => {
      expect(() =>
        MonthlyBudget.create(
          'mb-1',
          'ws-1',
          'cat-1',
          '2026-07',
          Money.zero('UAH'),
        ),
      ).toThrow(/amount must be greater than zero/i);
    });

    it('rejects a negative amount', () => {
      expect(() =>
        MonthlyBudget.create(
          'mb-1',
          'ws-1',
          'cat-1',
          '2026-07',
          Money.fromMinorUnits(-1, 'UAH'),
        ),
      ).toThrow(/amount must be greater than zero/i);
    });
  });
});
