import { describe, expect, it } from 'vitest';

import { resolveMonthRange } from './resolve-month-range.js';

describe('resolveMonthRange', () => {
  it('resolves July 2026 (EEST, +3 both ends) to its UTC instant range', () => {
    const range = resolveMonthRange('2026-07');

    expect(range.from.toISOString()).toBe('2026-06-30T21:00:00.000Z');
    expect(range.to.toISOString()).toBe('2026-07-31T21:00:00.000Z');
  });

  it('resolves January 2026 (EET, +2 both ends) to its UTC instant range', () => {
    const range = resolveMonthRange('2026-01');

    expect(range.from.toISOString()).toBe('2025-12-31T22:00:00.000Z');
    expect(range.to.toISOString()).toBe('2026-01-31T22:00:00.000Z');
  });

  it('resolves March 2026 (spring-forward mid-range, +2 -> +3) to its UTC instant range', () => {
    const range = resolveMonthRange('2026-03');

    expect(range.from.toISOString()).toBe('2026-02-28T22:00:00.000Z');
    expect(range.to.toISOString()).toBe('2026-03-31T21:00:00.000Z');
  });

  it('resolves October 2026 (fall-back mid-range, +3 -> +2) to its UTC instant range', () => {
    const range = resolveMonthRange('2026-10');

    expect(range.from.toISOString()).toBe('2026-09-30T21:00:00.000Z');
    expect(range.to.toISOString()).toBe('2026-10-31T22:00:00.000Z');
  });

  it('throws for a malformed month string', () => {
    expect(() => resolveMonthRange('2026-13')).toThrow(
      "Expected a 'YYYY-MM' month string, received: 2026-13",
    );
  });
});
