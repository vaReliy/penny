import LIVR from 'livr';
import { describe, expect, it } from 'vitest';

import { UPSERT_MONTHLY_BUDGET_SCHEMA } from './upsert-monthly-budget.schema.js';

const VALID_PAYLOAD: Record<string, unknown> = {
  categoryId: 'a'.repeat(24),
  month: '2026-07',
  amountMinorUnits: 500_000,
};

describe('UPSERT_MONTHLY_BUDGET_SCHEMA', () => {
  it('passes a valid payload through unchanged', () => {
    const validator = new LIVR.Validator(UPSERT_MONTHLY_BUDGET_SCHEMA);

    const result = validator.validate(VALID_PAYLOAD);

    expect(result).toEqual(VALID_PAYLOAD);
    expect(validator.getErrors()).toBeNull();
  });

  it.each(['categoryId', 'month', 'amountMinorUnits'] as const)(
    'rejects a payload missing the required field %s',
    (missingField) => {
      const validator = new LIVR.Validator(UPSERT_MONTHLY_BUDGET_SCHEMA);
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

  it('rejects a malformed categoryId', () => {
    const validator = new LIVR.Validator(UPSERT_MONTHLY_BUDGET_SCHEMA);

    const result = validator.validate({
      ...VALID_PAYLOAD,
      categoryId: 'not-an-id',
    });

    expect(result).toBe(false);
    expect(validator.getErrors()).toMatchObject({ categoryId: 'WRONG_FORMAT' });
  });

  it('rejects a malformed month', () => {
    const validator = new LIVR.Validator(UPSERT_MONTHLY_BUDGET_SCHEMA);

    const result = validator.validate({ ...VALID_PAYLOAD, month: '2026-7' });

    expect(result).toBe(false);
    expect(validator.getErrors()).toMatchObject({ month: 'WRONG_FORMAT' });
  });

  it('rejects a negative amount', () => {
    const validator = new LIVR.Validator(UPSERT_MONTHLY_BUDGET_SCHEMA);

    const result = validator.validate({
      ...VALID_PAYLOAD,
      amountMinorUnits: -100,
    });

    expect(result).toBe(false);
    expect(validator.getErrors()).toMatchObject({
      amountMinorUnits: 'NOT_POSITIVE_INTEGER',
    });
  });

  it('rejects a float amount', () => {
    const validator = new LIVR.Validator(UPSERT_MONTHLY_BUDGET_SCHEMA);

    const result = validator.validate({
      ...VALID_PAYLOAD,
      amountMinorUnits: 10.5,
    });

    expect(result).toBe(false);
    expect(validator.getErrors()).toMatchObject({
      amountMinorUnits: 'NOT_POSITIVE_INTEGER',
    });
  });

  it('rejects an amount above the max bound', () => {
    const validator = new LIVR.Validator(UPSERT_MONTHLY_BUDGET_SCHEMA);

    const result = validator.validate({
      ...VALID_PAYLOAD,
      amountMinorUnits: 1_000_000_000_01,
    });

    expect(result).toBe(false);
    expect(validator.getErrors()).toMatchObject({
      amountMinorUnits: 'TOO_HIGH',
    });
  });

  it.each(['categoryId', 'month', 'amountMinorUnits'] as const)(
    'rejects an operator-object payload in %s (Mongo-injection surface)',
    (field) => {
      const validator = new LIVR.Validator(UPSERT_MONTHLY_BUDGET_SCHEMA);

      const result = validator.validate({
        ...VALID_PAYLOAD,
        [field]: { $gt: '' },
      });

      expect(result).toBe(false);
      expect(validator.getErrors()).toMatchObject({ [field]: 'FORMAT_ERROR' });
    },
  );
});
