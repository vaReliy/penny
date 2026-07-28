import { describe, it, expect } from 'vitest';
import {
  parseHistoryFilter,
  toHistoryQueryParams,
  isHistoryFilterEmpty,
} from './history-filter-state';

describe('parseHistoryFilter', () => {
  it('returns an empty filter for empty params', () => {
    expect(parseHistoryFilter({})).toEqual({});
  });

  it('parses valid type/categoryId/period/month', () => {
    expect(
      parseHistoryFilter({
        type: 'income',
        categoryId: 'c1',
        period: 'month',
        month: '2026-07',
      }),
    ).toEqual({
      type: 'income',
      categoryId: 'c1',
      period: 'month',
      month: '2026-07',
    });
  });

  it('drops an invalid type value', () => {
    expect(parseHistoryFilter({ type: 'bogus' })).toEqual({});
  });

  it('drops an invalid period value', () => {
    expect(parseHistoryFilter({ period: 'year' })).toEqual({});
  });

  it('drops an empty-string categoryId', () => {
    expect(parseHistoryFilter({ categoryId: '' })).toEqual({});
  });

  it('drops an empty-string month', () => {
    expect(parseHistoryFilter({ month: '' })).toEqual({});
  });

  it('drops every invalid/empty field at once, keeping none', () => {
    expect(
      parseHistoryFilter({
        type: 'bogus',
        categoryId: '',
        period: 'year',
        month: '',
      }),
    ).toEqual({});
  });

  it('keeps a bare month with no period set (partial/malformed query params)', () => {
    expect(parseHistoryFilter({ month: '2026-07' })).toEqual({
      month: '2026-07',
    });
  });
});

describe('toHistoryQueryParams', () => {
  it('carries type/categoryId/period through unchanged', () => {
    expect(
      toHistoryQueryParams({
        type: 'expense',
        categoryId: 'c1',
        period: 'day',
      }),
    ).toEqual({
      type: 'expense',
      categoryId: 'c1',
      period: 'day',
      month: undefined,
    });
  });

  it('omits month when period is not "month"', () => {
    expect(toHistoryQueryParams({ period: 'week', month: '2026-07' })).toEqual({
      type: undefined,
      categoryId: undefined,
      period: 'week',
      month: undefined,
    });
  });

  it('includes month when period is "month"', () => {
    expect(toHistoryQueryParams({ period: 'month', month: '2026-07' })).toEqual(
      {
        type: undefined,
        categoryId: undefined,
        period: 'month',
        month: '2026-07',
      },
    );
  });
});

describe('parseHistoryFilter -> toHistoryQueryParams round-trip', () => {
  it('is idempotent for a well-formed filter (period + matching month)', () => {
    const params = {
      type: 'income',
      categoryId: 'c1',
      period: 'month',
      month: '2026-07',
    };
    expect(toHistoryQueryParams(parseHistoryFilter(params))).toEqual(params);
  });

  it('drops a bare month with no period on the round-trip — parse keeps it, serialize discards it', () => {
    // Documents a real asymmetry: parseHistoryFilter has no period/month
    // coupling, but toHistoryQueryParams only emits month when period is
    // 'month'. A malformed query string like `?month=2026-07` (no `period`)
    // parses to `{ month: '2026-07' }` but re-serializes without it.
    const parsed = parseHistoryFilter({ month: '2026-07' });
    expect(parsed).toEqual({ month: '2026-07' });
    expect(toHistoryQueryParams(parsed)).toEqual({
      type: undefined,
      categoryId: undefined,
      period: undefined,
      month: undefined,
    });
  });
});

describe('isHistoryFilterEmpty', () => {
  it('is true when no narrowing field is set', () => {
    expect(isHistoryFilterEmpty({})).toBe(true);
  });

  it('is false when any narrowing field is set', () => {
    expect(isHistoryFilterEmpty({ type: 'income' })).toBe(false);
    expect(isHistoryFilterEmpty({ categoryId: 'c1' })).toBe(false);
    expect(isHistoryFilterEmpty({ period: 'day' })).toBe(false);
  });
});
