import { describe, expect, it } from 'vitest';

import {
  currentMonth,
  formatMonthLabel,
  shiftMonth,
} from './planner-month.util';

describe('currentMonth', () => {
  it('formats the local calendar month as YYYY-MM', () => {
    expect(currentMonth(new Date(2026, 6, 29))).toBe('2026-07');
  });

  it('zero-pads single-digit months', () => {
    expect(currentMonth(new Date(2026, 0, 1))).toBe('2026-01');
  });
});

describe('shiftMonth', () => {
  it('advances within the same year', () => {
    expect(shiftMonth('2026-07', 1)).toBe('2026-08');
  });

  it('goes back within the same year', () => {
    expect(shiftMonth('2026-07', -1)).toBe('2026-06');
  });

  it('rolls forward across a year boundary', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });

  it('rolls backward across a year boundary', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });

  it('is a no-op for a zero delta', () => {
    expect(shiftMonth('2026-07', 0)).toBe('2026-07');
  });
});

describe('formatMonthLabel', () => {
  it('formats a YYYY-MM month as a localized month + year label', () => {
    expect(formatMonthLabel('2026-07')).toContain('2026');
  });
});
