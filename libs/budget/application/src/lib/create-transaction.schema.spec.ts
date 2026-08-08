import LIVR from 'livr';
import { describe, expect, it } from 'vitest';

import { CREATE_TRANSACTION_SCHEMA } from './create-transaction.schema.js';

const VALID_PAYLOAD: Record<string, unknown> = {
  accountId: 'a'.repeat(24),
  categoryId: 'b'.repeat(24),
  type: 'expense',
  amountMinorUnits: 1_500,
  date: '2026-07-20',
  description: 'Groceries',
};

describe('CREATE_TRANSACTION_SCHEMA', () => {
  it('passes a valid payload through unchanged', () => {
    const validator = new LIVR.Validator(CREATE_TRANSACTION_SCHEMA);

    const result = validator.validate(VALID_PAYLOAD);

    expect(result).toEqual(VALID_PAYLOAD);
    expect(validator.getErrors()).toBeNull();
  });

  it('passes a valid payload without the optional description', () => {
    const validator = new LIVR.Validator(CREATE_TRANSACTION_SCHEMA);
    const withoutDescription = Object.fromEntries(
      Object.entries(VALID_PAYLOAD).filter(([key]) => key !== 'description'),
    );

    const result = validator.validate(withoutDescription);

    expect(result).toEqual(withoutDescription);
    expect(validator.getErrors()).toBeNull();
  });

  it.each([
    'accountId',
    'categoryId',
    'type',
    'amountMinorUnits',
    'date',
  ] as const)(
    'rejects a payload missing the required field %s',
    (missingField) => {
      const validator = new LIVR.Validator(CREATE_TRANSACTION_SCHEMA);
      const incompletePayload = Object.fromEntries(
        Object.entries(VALID_PAYLOAD).filter(([key]) => key !== missingField),
      );

      const result = validator.validate(incompletePayload);

      expect(result).toBe(false);
      expect(validator.getErrors()).toMatchObject({
        [missingField]: 'REQUIRED',
      });
    },
  );

  it('rejects a type outside the income/expense enum', () => {
    const validator = new LIVR.Validator(CREATE_TRANSACTION_SCHEMA);

    const result = validator.validate({ ...VALID_PAYLOAD, type: 'transfer' });

    expect(result).toBe(false);
    expect(validator.getErrors()).toMatchObject({ type: 'NOT_ALLOWED_VALUE' });
  });

  it('rejects a malformed accountId', () => {
    const validator = new LIVR.Validator(CREATE_TRANSACTION_SCHEMA);

    const result = validator.validate({ ...VALID_PAYLOAD, accountId: 'short' });

    expect(result).toBe(false);
    expect(validator.getErrors()).toMatchObject({ accountId: 'WRONG_FORMAT' });
  });

  it('rejects a malformed categoryId', () => {
    const validator = new LIVR.Validator(CREATE_TRANSACTION_SCHEMA);

    const result = validator.validate({
      ...VALID_PAYLOAD,
      categoryId: 'short',
    });

    expect(result).toBe(false);
    expect(validator.getErrors()).toMatchObject({ categoryId: 'WRONG_FORMAT' });
  });

  it('rejects a negative amount', () => {
    const validator = new LIVR.Validator(CREATE_TRANSACTION_SCHEMA);

    const result = validator.validate({
      ...VALID_PAYLOAD,
      amountMinorUnits: -1,
    });

    expect(result).toBe(false);
    expect(validator.getErrors()).toMatchObject({
      amountMinorUnits: 'NOT_POSITIVE_INTEGER',
    });
  });

  it('rejects a float amount', () => {
    const validator = new LIVR.Validator(CREATE_TRANSACTION_SCHEMA);

    const result = validator.validate({
      ...VALID_PAYLOAD,
      amountMinorUnits: 1.5,
    });

    expect(result).toBe(false);
    expect(validator.getErrors()).toMatchObject({
      amountMinorUnits: 'NOT_POSITIVE_INTEGER',
    });
  });

  it('rejects a malformed date', () => {
    const validator = new LIVR.Validator(CREATE_TRANSACTION_SCHEMA);

    const result = validator.validate({ ...VALID_PAYLOAD, date: '20-07-2026' });

    expect(result).toBe(false);
    expect(validator.getErrors()).toMatchObject({ date: 'WRONG_DATE' });
  });

  it('rejects a description longer than the max length', () => {
    const validator = new LIVR.Validator(CREATE_TRANSACTION_SCHEMA);

    const result = validator.validate({
      ...VALID_PAYLOAD,
      description: 'a'.repeat(501),
    });

    expect(result).toBe(false);
    expect(validator.getErrors()).toMatchObject({ description: 'TOO_LONG' });
  });

  it.each([
    'accountId',
    'categoryId',
    'type',
    'amountMinorUnits',
    'date',
    'description',
  ] as const)(
    'rejects an operator-object payload in %s (Mongo-injection surface)',
    (field) => {
      const validator = new LIVR.Validator(CREATE_TRANSACTION_SCHEMA);

      const result = validator.validate({
        ...VALID_PAYLOAD,
        [field]: { $gt: '' },
      });

      expect(result).toBe(false);
      expect(validator.getErrors()).toMatchObject({ [field]: 'FORMAT_ERROR' });
    },
  );
});
