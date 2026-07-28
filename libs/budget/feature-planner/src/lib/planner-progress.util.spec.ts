import { describe, expect, it } from 'vitest';

import {
  computeBudgetPercent,
  resolveProgressDisplay,
  resolveProgressStatus,
} from './planner-progress.util';

describe('computeBudgetPercent', () => {
  it('returns 0 when budgeted is zero', () => {
    expect(computeBudgetPercent(5000n, 0n)).toBe(0);
  });

  it('returns 0 when budgeted is negative', () => {
    expect(computeBudgetPercent(5000n, -100n)).toBe(0);
  });

  it('computes an exact percentage with no rounding needed', () => {
    expect(computeBudgetPercent(5000n, 10000n)).toBe(50);
  });

  it('rounds half-up entirely in bigint', () => {
    expect(computeBudgetPercent(1n, 3n)).toBe(33);
    expect(computeBudgetPercent(2n, 3n)).toBe(67);
  });

  it('exceeds 100 when overspent', () => {
    expect(computeBudgetPercent(15000n, 10000n)).toBe(150);
  });
});

describe('resolveProgressStatus', () => {
  it.each([
    [0, 'success'],
    [59, 'success'],
    [60, 'success'],
    [61, 'warning'],
    [89, 'warning'],
    [90, 'warning'],
    [91, 'danger'],
    [100, 'danger'],
    [150, 'danger'],
  ] as const)('maps %d%% to %s', (percent, expected) => {
    expect(resolveProgressStatus(percent)).toBe(expected);
  });
});

describe('resolveProgressDisplay', () => {
  it('renders a spend-but-no-budget category as a fully filled danger bar, not an empty 0% one', () => {
    expect(resolveProgressDisplay(123158n, 0n)).toEqual({
      percent: 100,
      status: 'danger',
    });
  });

  it('renders a genuinely untouched 0/0 category as an empty success bar', () => {
    expect(resolveProgressDisplay(0n, 0n)).toEqual({
      percent: 0,
      status: 'success',
    });
  });

  it('falls back to the ordinary percent/status formula when budgeted is positive', () => {
    expect(resolveProgressDisplay(9500n, 10000n)).toEqual({
      percent: 95,
      status: 'danger',
    });
  });

  it('does not treat a negative budgeted with zero spend as an overspend', () => {
    expect(resolveProgressDisplay(0n, -100n)).toEqual({
      percent: 0,
      status: 'success',
    });
  });
});
