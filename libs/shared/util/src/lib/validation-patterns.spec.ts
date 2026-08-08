import { describe, expect, it } from 'vitest';

import {
  ID_PATTERN,
  MAX_DESCRIPTION_LENGTH,
  MAX_MONEY_MINOR_UNITS,
  MAX_NAME_LENGTH,
  MONTH_PATTERN,
} from './validation-patterns.js';

describe('ID_PATTERN', () => {
  it('matches a 24-char lowercase hex string', () => {
    expect(new RegExp(ID_PATTERN).test('a'.repeat(24))).toBe(true);
  });

  it('rejects a string of the wrong length', () => {
    expect(new RegExp(ID_PATTERN).test('a'.repeat(23))).toBe(false);
  });

  it('rejects uppercase hex characters', () => {
    expect(new RegExp(ID_PATTERN).test('A'.repeat(24))).toBe(false);
  });
});

describe('MONTH_PATTERN', () => {
  it.each(['2026-01', '2026-12', '2026-07'])(
    'matches a valid YYYY-MM month %s',
    (month) => {
      expect(new RegExp(MONTH_PATTERN).test(month)).toBe(true);
    },
  );

  it.each(['2026-00', '2026-13', '26-07', '2026/07', 'not-a-month'])(
    'rejects malformed month %s',
    (month) => {
      expect(new RegExp(MONTH_PATTERN).test(month)).toBe(false);
    },
  );
});

describe('constants', () => {
  it('MAX_MONEY_MINOR_UNITS stays within Number.MAX_SAFE_INTEGER', () => {
    expect(MAX_MONEY_MINOR_UNITS).toBeLessThan(Number.MAX_SAFE_INTEGER);
    expect(MAX_MONEY_MINOR_UNITS).toBe(100_000_000_000);
  });

  it('MAX_NAME_LENGTH is 120', () => {
    expect(MAX_NAME_LENGTH).toBe(120);
  });

  it('MAX_DESCRIPTION_LENGTH is 500', () => {
    expect(MAX_DESCRIPTION_LENGTH).toBe(500);
  });
});
