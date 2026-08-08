import LIVR from 'livr';
import { describe, expect, it } from 'vitest';

import { PLANNER_SUMMARY_FILTER_SCHEMA } from './planner-summary-filter.schema.js';

describe('PLANNER_SUMMARY_FILTER_SCHEMA', () => {
  it('passes a valid payload through unchanged', () => {
    const validator = new LIVR.Validator(PLANNER_SUMMARY_FILTER_SCHEMA);

    const result = validator.validate({ month: '2026-07' });

    expect(result).toEqual({ month: '2026-07' });
    expect(validator.getErrors()).toBeNull();
  });

  it('rejects a missing month', () => {
    const validator = new LIVR.Validator(PLANNER_SUMMARY_FILTER_SCHEMA);

    const result = validator.validate({});

    expect(result).toBe(false);
    expect(validator.getErrors()).toMatchObject({ month: 'REQUIRED' });
  });

  it('rejects a malformed month', () => {
    const validator = new LIVR.Validator(PLANNER_SUMMARY_FILTER_SCHEMA);

    const result = validator.validate({ month: '2026/07' });

    expect(result).toBe(false);
    expect(validator.getErrors()).toMatchObject({ month: 'WRONG_FORMAT' });
  });

  it('rejects an operator-object payload in month (Mongo-injection surface)', () => {
    const validator = new LIVR.Validator(PLANNER_SUMMARY_FILTER_SCHEMA);

    const result = validator.validate({ month: { $gt: '' } });

    expect(result).toBe(false);
    expect(validator.getErrors()).toMatchObject({ month: 'FORMAT_ERROR' });
  });
});
