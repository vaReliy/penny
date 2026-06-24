import { describe, expect, it } from 'vitest';

import { Money } from './money.js';

describe('Money', () => {
  it('adds two Money values with the same currency', () => {
    const a = Money.fromMinorUnits(150, 'USD');
    const b = Money.fromMinorUnits(250, 'USD');

    const result = a.add(b);

    expect(result.amount).toBe(400n);
    expect(result.currency).toBe('USD');
  });

  it('subtracts two Money values with the same currency', () => {
    const a = Money.fromMinorUnits(500, 'USD');
    const b = Money.fromMinorUnits(150, 'USD');

    const result = a.subtract(b);

    expect(result.amount).toBe(350n);
  });

  it('throws when adding mismatched currencies', () => {
    const usd = Money.fromMinorUnits(100, 'USD');
    const eur = Money.fromMinorUnits(100, 'EUR');

    expect(() => usd.add(eur)).toThrow(/mismatched currencies/i);
  });

  it('throws when subtracting mismatched currencies', () => {
    const usd = Money.fromMinorUnits(100, 'USD');
    const eur = Money.fromMinorUnits(100, 'EUR');

    expect(() => usd.subtract(eur)).toThrow(/mismatched currencies/i);
  });

  it('throws when comparing mismatched currencies', () => {
    const usd = Money.fromMinorUnits(100, 'USD');
    const eur = Money.fromMinorUnits(100, 'EUR');

    expect(() => usd.compare(eur)).toThrow(/mismatched currencies/i);
  });

  it('compares amounts of the same currency', () => {
    const small = Money.fromMinorUnits(100, 'USD');
    const large = Money.fromMinorUnits(200, 'USD');

    expect(small.compare(large)).toBeLessThan(0);
    expect(large.compare(small)).toBeGreaterThan(0);
    expect(small.compare(Money.fromMinorUnits(100, 'USD'))).toBe(0);
    expect(small.isLessThan(large)).toBe(true);
    expect(large.isGreaterThan(small)).toBe(true);
  });

  it('treats equal amount and currency as equal', () => {
    const a = Money.fromMinorUnits(999, 'USD');
    const b = Money.fromMinorUnits(999, 'USD');
    const c = Money.fromMinorUnits(999, 'EUR');

    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });

  it('normalizes currency code casing so USD and usd are treated as equal', () => {
    const a = Money.fromMinorUnits(100, 'usd');
    const b = Money.fromMinorUnits(100, 'USD');

    expect(a.equals(b)).toBe(true);
    expect(a.currency).toBe('USD');
  });

  it('rejects non-integer amounts to avoid float arithmetic', () => {
    expect(() => Money.fromMinorUnits(10.5, 'USD')).toThrow(/integer/i);
  });

  it('rejects an empty currency code', () => {
    expect(() => Money.fromMinorUnits(100, '   ')).toThrow(
      /currency code must not be empty/i,
    );
  });

  it('supports bigint amounts beyond Number.MAX_SAFE_INTEGER without precision loss', () => {
    const huge = 9_007_199_254_740_993n; // MAX_SAFE_INTEGER + 2
    const money = Money.fromMinorUnits(huge, 'USD');

    expect(money.amount).toBe(huge);
  });

  it('round-trips through (de)serialization without precision loss', () => {
    const original = Money.fromMinorUnits(123_456_789n, 'EUR');

    const serialized = original.toJSON();
    const restored = Money.fromJSON(serialized);

    expect(serialized).toEqual({ amount: '123456789', currency: 'EUR' });
    expect(restored.equals(original)).toBe(true);
  });

  it('round-trips a huge bigint amount through JSON.stringify/parse', () => {
    const huge = 99_999_999_999_999_999_999n;
    const original = Money.fromMinorUnits(huge, 'USD');

    const json = JSON.stringify(original);
    const parsed = JSON.parse(json) as { amount: string; currency: string };
    const restored = Money.fromJSON(parsed);

    expect(restored.amount).toBe(huge);
  });

  it('reports zero and negative amounts correctly', () => {
    const zero = Money.zero('USD');
    const negative = Money.fromMinorUnits(-100, 'USD');

    expect(zero.isZero()).toBe(true);
    expect(negative.isNegative()).toBe(true);
    expect(negative.isZero()).toBe(false);
  });
});
