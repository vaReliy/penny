import LIVR from 'livr';
import { describe, expect, it } from 'vitest';

import { UPDATE_CATEGORY_SCHEMA } from './update-category.schema.js';

describe('UPDATE_CATEGORY_SCHEMA', () => {
  it('passes a valid payload through unchanged', () => {
    const validator = new LIVR.Validator(UPDATE_CATEGORY_SCHEMA);

    const result = validator.validate({ name: 'Groceries (renamed)' });

    expect(result).toEqual({ name: 'Groceries (renamed)' });
    expect(validator.getErrors()).toBeNull();
  });

  it('rejects a missing name', () => {
    const validator = new LIVR.Validator(UPDATE_CATEGORY_SCHEMA);

    const result = validator.validate({});

    expect(result).toBe(false);
    expect(validator.getErrors()).toMatchObject({ name: 'REQUIRED' });
  });

  it('rejects a name longer than the max length', () => {
    const validator = new LIVR.Validator(UPDATE_CATEGORY_SCHEMA);

    const result = validator.validate({ name: 'a'.repeat(121) });

    expect(result).toBe(false);
    expect(validator.getErrors()).toMatchObject({ name: 'TOO_LONG' });
  });

  it('rejects an operator-object payload in name (Mongo-injection surface)', () => {
    const validator = new LIVR.Validator(UPDATE_CATEGORY_SCHEMA);

    const result = validator.validate({ name: { $gt: '' } });

    expect(result).toBe(false);
    expect(validator.getErrors()).toMatchObject({ name: 'FORMAT_ERROR' });
  });
});
