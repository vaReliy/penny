import { describe, it, expect } from 'vitest';
import { Money } from 'shared-util';
import { convertBalanceToCurrency } from './convert-balance.util';

describe('convertBalanceToCurrency', () => {
  it('converts UAH minor units into USD minor units using a 4-decimal rate', () => {
    const balance = Money.fromMinorUnits(415000n, 'UAH'); // 4150.00 UAH
    const converted = convertBalanceToCurrency(balance, {
      currency: 'USD',
      rateToBase: '41.5000',
    });

    expect(converted.currency).toBe('USD');
    expect(converted.amount).toBe(10000n); // 100.00 USD
  });

  it('rounds to the nearest minor unit instead of truncating', () => {
    const balance = Money.fromMinorUnits(100n, 'UAH'); // 1.00 UAH
    const converted = convertBalanceToCurrency(balance, {
      currency: 'USD',
      rateToBase: '3.0000',
    });

    // 100 / 3 = 33.333... -> rounds to 33
    expect(converted.amount).toBe(33n);
  });

  it('never produces a binary-float artifact for an operand pair known to trigger rounding', () => {
    // 27.1 + 27.3 in raw float arithmetic yields 27.200000000000003 — this
    // util must never touch Number for the rate itself.
    const balance = Money.fromMinorUnits(2720000n, 'UAH'); // 27200.00 UAH
    const converted = convertBalanceToCurrency(balance, {
      currency: 'EUR',
      rateToBase: '27.2000',
    });

    expect(converted.amount).toBe(100000n); // exactly 1000.00 EUR
  });

  it('handles a negative balance (round half away from zero)', () => {
    const balance = Money.fromMinorUnits(-100n, 'UAH');
    const converted = convertBalanceToCurrency(balance, {
      currency: 'USD',
      rateToBase: '3.0000',
    });

    expect(converted.amount).toBe(-33n);
  });

  it('rounds an exact .5 boundary up (away from zero) for a positive balance', () => {
    const balance = Money.fromMinorUnits(101n, 'UAH'); // 1.01 UAH
    const converted = convertBalanceToCurrency(balance, {
      currency: 'USD',
      rateToBase: '2.0000',
    });

    // 101 / 2 = 50.5 exactly -> rounds to 51, not banker's-rounds to 50
    expect(converted.amount).toBe(51n);
  });

  it('rounds an exact .5 boundary down (away from zero) for a negative balance', () => {
    const balance = Money.fromMinorUnits(-101n, 'UAH');
    const converted = convertBalanceToCurrency(balance, {
      currency: 'USD',
      rateToBase: '2.0000',
    });

    expect(converted.amount).toBe(-51n);
  });

  it('converts a zero balance to a zero amount in the target currency', () => {
    const balance = Money.zero('UAH');
    const converted = convertBalanceToCurrency(balance, {
      currency: 'USD',
      rateToBase: '41.5000',
    });

    expect(converted.amount).toBe(0n);
    expect(converted.currency).toBe('USD');
  });

  it('is a no-op amount-wise for a rate of exactly 1', () => {
    const balance = Money.fromMinorUnits(415000n, 'UAH');
    const converted = convertBalanceToCurrency(balance, {
      currency: 'USD',
      rateToBase: '1.0000',
    });

    expect(converted.amount).toBe(415000n);
  });

  it('accepts an integer-valued rate string with no decimal point', () => {
    const balance = Money.fromMinorUnits(4100n, 'UAH'); // 41.00 UAH
    const converted = convertBalanceToCurrency(balance, {
      currency: 'USD',
      rateToBase: '41',
    });

    expect(converted.amount).toBe(100n); // 1.00 USD
  });

  it('yields the same result regardless of the rate string decimal-place count', () => {
    const balance = Money.fromMinorUnits(415000n, 'UAH');
    const twoDecimal = convertBalanceToCurrency(balance, {
      currency: 'USD',
      rateToBase: '41.50',
    });
    const fourDecimal = convertBalanceToCurrency(balance, {
      currency: 'USD',
      rateToBase: '41.5000',
    });

    expect(twoDecimal.amount).toBe(fourDecimal.amount);
    expect(twoDecimal.amount).toBe(10000n);
  });

  it('throws on a malformed (non-numeric) rate string rather than silently miscalculating', () => {
    const balance = Money.fromMinorUnits(100n, 'UAH');

    expect(() =>
      convertBalanceToCurrency(balance, { currency: 'USD', rateToBase: 'abc' }),
    ).toThrow();
  });

  it('throws on an empty rate string (division by zero) rather than silently miscalculating', () => {
    const balance = Money.fromMinorUnits(100n, 'UAH');

    expect(() =>
      convertBalanceToCurrency(balance, { currency: 'USD', rateToBase: '' }),
    ).toThrow(RangeError);
  });
});
