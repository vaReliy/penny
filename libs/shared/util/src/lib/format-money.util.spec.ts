import { describe, it, expect } from 'vitest';
import { Money } from './money.js';
import { formatMoney } from './format-money.util.js';

describe('formatMoney', () => {
  it('formats a UAH amount with a comma decimal separator and 2 decimal digits', () => {
    const money = Money.fromMinorUnits(500000, 'UAH');
    expect(formatMoney(money)).toMatch(/5\D000,00/);
  });

  it('formats a small amount without dropping the minor-unit digits', () => {
    const money = Money.fromMinorUnits(5, 'UAH');
    expect(formatMoney(money)).toContain('0,05');
  });

  it('formats UAH minor units as a localized currency string', () => {
    const money = Money.fromMinorUnits(415050n, 'UAH');
    expect(formatMoney(money)).toContain('4');
    expect(formatMoney(money)).toContain('150');
  });

  it('formats a zero balance', () => {
    const money = Money.zero('UAH');
    const formatted = formatMoney(money);
    expect(formatted).toContain('0');
  });

  it('formats a negative amount without dropping the sign', () => {
    const money = Money.fromMinorUnits(-415050n, 'UAH');
    const formatted = formatMoney(money);
    expect(formatted).toMatch(/-/);
    expect(formatted).toContain('150');
  });

  it('renders a thousands separator for large amounts', () => {
    const money = Money.fromMinorUnits(123456789n, 'UAH'); // 1 234 567.89 UAH
    const formatted = formatMoney(money);
    // uk-UA groups with a non-breaking/narrow-no-break space, not a comma —
    // assert the digit groups land correctly rather than a specific separator char.
    expect(formatted).toContain('234');
    expect(formatted).toContain('567');
  });

  it('never loses minor-unit precision for an amount that is not exactly representable as a float', () => {
    // 0.29 in binary float is 0.28999999999999998..., which historically
    // trips up naive `amount / 100` formatting for exactly this cent value.
    const money = Money.fromMinorUnits(29n, 'UAH');
    const formatted = formatMoney(money);
    expect(formatted).toContain('0');
    expect(formatted).toContain('29');
    expect(formatted).not.toContain('28');
  });

  it('formats a non-UAH currency using its own symbol/code, not a hardcoded UAH one', () => {
    const money = Money.fromMinorUnits(150099n, 'USD');
    const formatted = formatMoney(money);
    expect(formatted).toContain('500');
    expect(formatted).toContain('99');
    expect(formatted).not.toContain('₴');
  });
});
