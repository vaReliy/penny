import { describe, expect, it } from 'vitest';

import { escapeRegExp } from './escape-reg-exp.js';

describe('escapeRegExp', () => {
  it('escapes regex special characters so they match literally', () => {
    const escaped = escapeRegExp('.*');
    expect(new RegExp(escaped).test('.*')).toBe(true);
    expect(new RegExp(escaped).test('anything')).toBe(false);
  });

  it('leaves plain alphanumeric input unchanged', () => {
    expect(escapeRegExp('alice')).toBe('alice');
  });

  it('escapes every special character in a mixed string', () => {
    const input = 'a.b*c+d?e^f$g{h}i(j)k|l[m]n\\o';
    const escaped = escapeRegExp(input);
    expect(new RegExp(`^${escaped}$`).test(input)).toBe(true);
  });
});
