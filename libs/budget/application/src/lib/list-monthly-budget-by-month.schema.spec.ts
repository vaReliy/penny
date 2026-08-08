import LIVR from 'livr';
import { describe, expect, it } from 'vitest';

import { LIST_MONTHLY_BUDGET_BY_MONTH_SCHEMA } from './list-monthly-budget-by-month.schema.js';

describe('LIST_MONTHLY_BUDGET_BY_MONTH_SCHEMA', () => {
  it('passes a valid payload through unchanged', () => {
    const validator = new LIVR.Validator(LIST_MONTHLY_BUDGET_BY_MONTH_SCHEMA);

    const result = validator.validate({ month: '2026-07' });

    expect(result).toEqual({ month: '2026-07' });
    expect(validator.getErrors()).toBeNull();
  });

  it('rejects a missing month', () => {
    const validator = new LIVR.Validator(LIST_MONTHLY_BUDGET_BY_MONTH_SCHEMA);

    const result = validator.validate({});

    expect(result).toBe(false);
    expect(validator.getErrors()).toMatchObject({ month: 'REQUIRED' });
  });

  it.each(['2026-7', '26-07', '2026/07', '2026-13', 'not-a-month'])(
    'rejects malformed month %s',
    (month) => {
      const validator = new LIVR.Validator(LIST_MONTHLY_BUDGET_BY_MONTH_SCHEMA);

      const result = validator.validate({ month });

      expect(result).toBe(false);
      expect(validator.getErrors()).toMatchObject({ month: 'WRONG_FORMAT' });
    },
  );

  it('rejects an operator-object payload in month (Mongo-injection surface)', () => {
    const validator = new LIVR.Validator(LIST_MONTHLY_BUDGET_BY_MONTH_SCHEMA);

    const result = validator.validate({ month: { $ne: null } });

    expect(result).toBe(false);
    expect(validator.getErrors()).toMatchObject({ month: 'FORMAT_ERROR' });
  });
});
