import { describe, expect, it } from 'vitest';

import { parseAmountToMinorUnits } from './parse-amount.util.js';

describe('parseAmountToMinorUnits', () => {
  it('converts a comma-decimal amount to integer kopiykas', () => {
    expect(parseAmountToMinorUnits('123,45')).toBe(12345);
  });

  it('converts a dot-decimal amount to integer kopiykas', () => {
    expect(parseAmountToMinorUnits('123.4')).toBe(12340);
  });

  it('converts a whole-number amount with no fraction', () => {
    expect(parseAmountToMinorUnits('100')).toBe(10000);
  });

  it('pads a single fraction digit to two', () => {
    expect(parseAmountToMinorUnits('1,5')).toBe(150);
  });

  it('never round-trips through float arithmetic (0.1 + 0.2 style input stays exact)', () => {
    expect(parseAmountToMinorUnits('0,1')).toBe(10);
    expect(parseAmountToMinorUnits('0,29')).toBe(29);
  });

  it('rejects empty input', () => {
    expect(parseAmountToMinorUnits('')).toBeNull();
    expect(parseAmountToMinorUnits('   ')).toBeNull();
  });

  it('rejects zero and negative amounts', () => {
    expect(parseAmountToMinorUnits('0')).toBeNull();
    expect(parseAmountToMinorUnits('-5')).toBeNull();
  });

  it('rejects non-numeric input', () => {
    expect(parseAmountToMinorUnits('abc')).toBeNull();
    expect(parseAmountToMinorUnits('12,345')).toBeNull();
  });

  it('rejects amounts above the maximum', () => {
    expect(parseAmountToMinorUnits('10000000001')).toBeNull();
  });

  it('accepts the exact maximum amount', () => {
    expect(parseAmountToMinorUnits('1000000000.00')).toBe(100_000_000_000);
  });

  it('rejects one kopiyka above the maximum', () => {
    expect(parseAmountToMinorUnits('1000000000.01')).toBeNull();
  });
});
