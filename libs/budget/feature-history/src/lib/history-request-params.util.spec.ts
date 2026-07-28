import { describe, it, expect } from 'vitest';
import {
  toListTransactionsParams,
  toHistoryChartParams,
} from './history-request-params.util';

const TODAY = new Date(2026, 6, 28); // 2026-07-28, a Tuesday

describe('toListTransactionsParams', () => {
  // `ListTransactionsService` rejects any call carrying neither `month` nor
  // both `from`/`to`, so an unscoped params object is never a valid request.
  it('falls back to the current month when the filter selects no period', () => {
    expect(toListTransactionsParams({}, TODAY)).toEqual({ month: '2026-07' });
  });

  it('carries type and categoryId through unchanged', () => {
    expect(
      toListTransactionsParams({ type: 'income', categoryId: 'c1' }, TODAY),
    ).toEqual({ type: 'income', categoryId: 'c1', month: '2026-07' });
  });

  it('resolves period "day" to a from/to range', () => {
    const params = toListTransactionsParams({ period: 'day' }, TODAY);
    expect(params.from?.toISOString().slice(0, 10)).toBe('2026-07-28');
    expect(params.to?.toISOString().slice(0, 10)).toBe('2026-07-28');
  });

  it('resolves period "month" with an explicit month to that month', () => {
    expect(
      toListTransactionsParams({ period: 'month', month: '2026-03' }, TODAY),
    ).toEqual({ month: '2026-03' });
  });

  it('resolves period "month" with no explicit month to the current month', () => {
    expect(toListTransactionsParams({ period: 'month' }, TODAY)).toEqual({
      month: '2026-07',
    });
  });

  it('resolves period "week" to a from/to range, combined with type/categoryId', () => {
    const params = toListTransactionsParams(
      { type: 'expense', categoryId: 'c1', period: 'week' },
      TODAY,
    );
    expect(params.type).toBe('expense');
    expect(params.categoryId).toBe('c1');
    expect(params.from?.toISOString().slice(0, 10)).toBe('2026-07-27');
    expect(params.to?.toISOString().slice(0, 10)).toBe('2026-08-02');
  });
});

describe('toHistoryChartParams', () => {
  it('ignores type/categoryId, keeping only the date scope', () => {
    expect(
      toHistoryChartParams(
        { type: 'income', categoryId: 'c1', period: 'month', month: '2026-03' },
        TODAY,
      ),
    ).toEqual({ month: '2026-03' });
  });

  it('returns an empty params object when no period is set', () => {
    expect(toHistoryChartParams({ type: 'expense' }, TODAY)).toEqual({});
  });

  it('resolves period "day"/"week" to a from/to range, same as the list mapper', () => {
    expect(toHistoryChartParams({ period: 'day' }, TODAY)).toEqual(
      toListTransactionsParams({ period: 'day' }, TODAY),
    );
    expect(toHistoryChartParams({ period: 'week' }, TODAY)).toEqual(
      toListTransactionsParams({ period: 'week' }, TODAY),
    );
  });
});
