import { describe, it, expect } from 'vitest';
import { resolvePeriodRange, currentMonth } from './history-period.util';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

describe('resolvePeriodRange', () => {
  it('"day" resolves to a single-day range at today\'s local calendar date', () => {
    const today = new Date(2026, 6, 28); // 2026-07-28, local time
    const { from, to } = resolvePeriodRange('day', today);

    expect(from.toISOString().slice(0, 10)).toBe('2026-07-28');
    expect(to.toISOString().slice(0, 10)).toBe('2026-07-28');
  });

  it('"week" resolves to the Monday-Sunday range containing today', () => {
    const today = new Date(2026, 6, 28); // 2026-07-28 is a Tuesday
    const { from, to } = resolvePeriodRange('week', today);

    expect(from.getUTCDay()).toBe(1); // Monday
    expect(to.getUTCDay()).toBe(0); // Sunday
    expect(to.getTime() - from.getTime()).toBe(6 * MS_PER_DAY);
    expect(from.toISOString().slice(0, 10)).toBe('2026-07-27');
    expect(to.toISOString().slice(0, 10)).toBe('2026-08-02');
  });

  it('"week" rolls correctly across a month/year boundary', () => {
    const today = new Date(2026, 0, 1); // 2026-01-01 is a Thursday
    const { from, to } = resolvePeriodRange('week', today);

    expect(from.toISOString().slice(0, 10)).toBe('2025-12-29');
    expect(to.toISOString().slice(0, 10)).toBe('2026-01-04');
  });

  it('"week" rolls forward across a year boundary (Dec 31 -> Jan 1)', () => {
    const today = new Date(2025, 11, 31); // 2025-12-31 is a Wednesday
    const { from, to } = resolvePeriodRange('week', today);

    expect(from.toISOString().slice(0, 10)).toBe('2025-12-29');
    expect(to.toISOString().slice(0, 10)).toBe('2026-01-04');
  });

  it('"week" rolls correctly across a non-leap-year Feb/Mar boundary', () => {
    const today = new Date(2026, 1, 25); // 2026-02-25 is a Wednesday
    const { from, to } = resolvePeriodRange('week', today);

    expect(from.toISOString().slice(0, 10)).toBe('2026-02-23');
    expect(to.toISOString().slice(0, 10)).toBe('2026-03-01');
  });

  it('"week" rolls correctly across a leap-year Feb 29 boundary', () => {
    const today = new Date(2028, 1, 29); // 2028-02-29 is a Tuesday (leap day)
    const { from, to } = resolvePeriodRange('week', today);

    expect(from.toISOString().slice(0, 10)).toBe('2028-02-28');
    expect(to.toISOString().slice(0, 10)).toBe('2028-03-05');
  });

  it('"day" resolves correctly on a leap-year Feb 29', () => {
    const today = new Date(2028, 1, 29); // 2028-02-29
    const { from, to } = resolvePeriodRange('day', today);

    expect(from.toISOString().slice(0, 10)).toBe('2028-02-29');
    expect(to.toISOString().slice(0, 10)).toBe('2028-02-29');
  });
});

describe('currentMonth', () => {
  it('formats as YYYY-MM, zero-padded', () => {
    expect(currentMonth(new Date(2026, 0, 15))).toBe('2026-01');
    expect(currentMonth(new Date(2026, 10, 3))).toBe('2026-11');
  });
});
