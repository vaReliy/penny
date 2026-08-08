import LIVR from 'livr';
import { describe, expect, it } from 'vitest';

import { TRANSACTION_FILTER_SCHEMA } from './transaction-filter.schema.js';

describe('TRANSACTION_FILTER_SCHEMA', () => {
  it('passes an empty payload through unchanged (all filters optional)', () => {
    const validator = new LIVR.Validator(TRANSACTION_FILTER_SCHEMA);

    const result = validator.validate({});

    expect(result).toEqual({});
    expect(validator.getErrors()).toBeNull();
  });

  it('passes a fully-populated valid payload through unchanged', () => {
    const validator = new LIVR.Validator(TRANSACTION_FILTER_SCHEMA);
    const payload = {
      type: 'income',
      categoryId: 'a'.repeat(24),
      accountId: 'b'.repeat(24),
      from: '2026-07-01',
      to: '2026-07-31',
      month: '2026-07',
    };

    const result = validator.validate(payload);

    expect(result).toEqual(payload);
    expect(validator.getErrors()).toBeNull();
  });

  it('rejects a type outside the income/expense enum', () => {
    const validator = new LIVR.Validator(TRANSACTION_FILTER_SCHEMA);

    const result = validator.validate({ type: 'transfer' });

    expect(result).toBe(false);
    expect(validator.getErrors()).toMatchObject({ type: 'NOT_ALLOWED_VALUE' });
  });

  it('rejects a malformed categoryId', () => {
    const validator = new LIVR.Validator(TRANSACTION_FILTER_SCHEMA);

    const result = validator.validate({ categoryId: 'not-an-id' });

    expect(result).toBe(false);
    expect(validator.getErrors()).toMatchObject({ categoryId: 'WRONG_FORMAT' });
  });

  it('rejects a malformed accountId', () => {
    const validator = new LIVR.Validator(TRANSACTION_FILTER_SCHEMA);

    const result = validator.validate({ accountId: 'not-an-id' });

    expect(result).toBe(false);
    expect(validator.getErrors()).toMatchObject({ accountId: 'WRONG_FORMAT' });
  });

  it('rejects a malformed from date', () => {
    const validator = new LIVR.Validator(TRANSACTION_FILTER_SCHEMA);

    const result = validator.validate({ from: 'not-a-date' });

    expect(result).toBe(false);
    expect(validator.getErrors()).toMatchObject({ from: 'WRONG_DATE' });
  });

  it('rejects a malformed to date', () => {
    const validator = new LIVR.Validator(TRANSACTION_FILTER_SCHEMA);

    const result = validator.validate({ to: 'not-a-date' });

    expect(result).toBe(false);
    expect(validator.getErrors()).toMatchObject({ to: 'WRONG_DATE' });
  });

  it('rejects a malformed month', () => {
    const validator = new LIVR.Validator(TRANSACTION_FILTER_SCHEMA);

    const result = validator.validate({ month: '2026-13' });

    expect(result).toBe(false);
    expect(validator.getErrors()).toMatchObject({ month: 'WRONG_FORMAT' });
  });

  it.each(['type', 'categoryId', 'accountId', 'from', 'to', 'month'] as const)(
    'rejects an operator-object payload in %s (Mongo-injection surface)',
    (field) => {
      const validator = new LIVR.Validator(TRANSACTION_FILTER_SCHEMA);

      const result = validator.validate({ [field]: { $gt: '' } });

      expect(result).toBe(false);
      expect(validator.getErrors()).toMatchObject({ [field]: 'FORMAT_ERROR' });
    },
  );
});
