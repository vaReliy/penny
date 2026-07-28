import { describe, expect, it } from 'vitest';
import { Money } from 'shared-util';
import type { CategoryView, PlannerSummaryView } from 'budget-data-access';

import {
  buildPlannerRows,
  isPlannerMonthEmpty,
  sumMoney,
} from './planner-rows.util';

function category(id: string, name: string, archivedAt?: Date): CategoryView {
  return archivedAt === undefined ? { id, name } : { id, name, archivedAt };
}

describe('buildPlannerRows', () => {
  it('excludes archived categories', () => {
    const categories = [category('c1', 'Food', new Date())];
    const rows = buildPlannerRows(categories, null);
    expect(rows).toHaveLength(0);
  });

  it('zeroes budgeted/spent for a category absent from the summary', () => {
    const categories = [category('c1', 'Food')];
    const rows = buildPlannerRows(categories, null);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.budgeted.isZero()).toBe(true);
    expect(rows[0]?.spent.isZero()).toBe(true);
    expect(rows[0]?.percent).toBe(0);
    expect(rows[0]?.status).toBe('success');
  });

  it('renders a category with a budget but no spend distinctly', () => {
    const categories = [category('c1', 'Food')];
    const summary: PlannerSummaryView = {
      month: '2026-07',
      categories: [
        {
          categoryId: 'c1',
          budgeted: Money.fromMinorUnits(10000, 'UAH'),
          spent: Money.fromMinorUnits(0, 'UAH'),
          remaining: Money.fromMinorUnits(10000, 'UAH'),
        },
      ],
    };
    const rows = buildPlannerRows(categories, summary);
    expect(rows[0]?.budgeted.amount).toBe(10000n);
    expect(rows[0]?.spent.isZero()).toBe(true);
  });

  it('renders a category with spend but no budget distinctly', () => {
    const categories = [category('c1', 'Food')];
    const summary: PlannerSummaryView = {
      month: '2026-07',
      categories: [
        {
          categoryId: 'c1',
          budgeted: Money.fromMinorUnits(0, 'UAH'),
          spent: Money.fromMinorUnits(5000, 'UAH'),
          remaining: Money.fromMinorUnits(-5000, 'UAH'),
        },
      ],
    };
    const rows = buildPlannerRows(categories, summary);
    expect(rows[0]?.budgeted.isZero()).toBe(true);
    expect(rows[0]?.spent.amount).toBe(5000n);
    expect(rows[0]?.remaining.amount).toBe(-5000n);
    // Spend-but-no-budget must render as a fully filled danger bar, never
    // an empty 0% bar indistinguishable from a genuinely untouched category.
    expect(rows[0]?.percent).toBe(100);
    expect(rows[0]?.status).toBe('danger');
  });

  it('computes percent/status from the joined budgeted/spent amounts', () => {
    const categories = [category('c1', 'Food')];
    const summary: PlannerSummaryView = {
      month: '2026-07',
      categories: [
        {
          categoryId: 'c1',
          budgeted: Money.fromMinorUnits(10000, 'UAH'),
          spent: Money.fromMinorUnits(9500, 'UAH'),
          remaining: Money.fromMinorUnits(500, 'UAH'),
        },
      ],
    };
    const rows = buildPlannerRows(categories, summary);
    expect(rows[0]?.percent).toBe(95);
    expect(rows[0]?.status).toBe('danger');
  });
});

describe('isPlannerMonthEmpty', () => {
  it('is true when there are no rows', () => {
    expect(isPlannerMonthEmpty([])).toBe(true);
  });

  it('is true when every row has zero budget and zero spend', () => {
    const rows = buildPlannerRows([category('c1', 'Food')], null);
    expect(isPlannerMonthEmpty(rows)).toBe(true);
  });

  it('is false when at least one row has a nonzero budget or spend', () => {
    const summary: PlannerSummaryView = {
      month: '2026-07',
      categories: [
        {
          categoryId: 'c1',
          budgeted: Money.fromMinorUnits(10000, 'UAH'),
          spent: Money.fromMinorUnits(0, 'UAH'),
          remaining: Money.fromMinorUnits(10000, 'UAH'),
        },
      ],
    };
    const rows = buildPlannerRows([category('c1', 'Food')], summary);
    expect(isPlannerMonthEmpty(rows)).toBe(false);
  });
});

describe('sumMoney', () => {
  it('sums same-currency values', () => {
    const values = [
      Money.fromMinorUnits(1000, 'UAH'),
      Money.fromMinorUnits(2500, 'UAH'),
    ];
    expect(sumMoney(values, 'UAH').amount).toBe(3500n);
  });

  it('returns a zero value in the fallback currency for an empty list', () => {
    const total = sumMoney([], 'UAH');
    expect(total.isZero()).toBe(true);
    expect(total.currency).toBe('UAH');
  });
});
