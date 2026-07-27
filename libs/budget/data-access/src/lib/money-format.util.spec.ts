import { describe, it, expect } from 'vitest';
import { Money } from 'shared-util';
import { formatMoney } from './money-format.util.js';

describe('formatMoney', () => {
  it('formats a UAH amount with a comma decimal separator and 2 decimal digits', () => {
    const money = Money.fromMinorUnits(500000, 'UAH');
    expect(formatMoney(money)).toMatch(/5\D000,00/);
  });

  it('formats a small amount without dropping the minor-unit digits', () => {
    const money = Money.fromMinorUnits(5, 'UAH');
    expect(formatMoney(money)).toContain('0,05');
  });
});
