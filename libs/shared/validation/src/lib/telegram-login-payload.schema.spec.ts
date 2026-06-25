import LIVR from 'livr';
import { describe, expect, it } from 'vitest';

import { TELEGRAM_LOGIN_PAYLOAD_SCHEMA } from './telegram-login-payload.schema.js';

/** A fully-populated, well-formed raw Telegram Login Widget payload. */
const VALID_PAYLOAD: Record<string, unknown> = {
  id: 123456789,
  auth_date: 1_700_000_000,
  hash: 'a'.repeat(64),
  first_name: 'Ada',
  last_name: 'Lovelace',
  username: 'ada',
  photo_url: 'https://example.com/ada.png',
};

describe('TELEGRAM_LOGIN_PAYLOAD_SCHEMA', () => {
  it('passes a valid payload through unchanged', () => {
    const validator = new LIVR.Validator(TELEGRAM_LOGIN_PAYLOAD_SCHEMA);

    const result = validator.validate(VALID_PAYLOAD);

    expect(result).toEqual(VALID_PAYLOAD);
    expect(validator.getErrors()).toBeNull();
  });

  it.each(['id', 'auth_date', 'hash'] as const)(
    'rejects a payload missing the required field %s',
    (missingField) => {
      const validator = new LIVR.Validator(TELEGRAM_LOGIN_PAYLOAD_SCHEMA);
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

  it('rejects a non-numeric id', () => {
    const validator = new LIVR.Validator(TELEGRAM_LOGIN_PAYLOAD_SCHEMA);

    const result = validator.validate({
      ...VALID_PAYLOAD,
      id: 'not-a-number',
    });

    expect(result).toBe(false);
    expect(validator.getErrors()).toMatchObject({
      id: 'NOT_POSITIVE_INTEGER',
    });
  });

  it('rejects a non-numeric auth_date', () => {
    const validator = new LIVR.Validator(TELEGRAM_LOGIN_PAYLOAD_SCHEMA);

    const result = validator.validate({
      ...VALID_PAYLOAD,
      auth_date: 'not-a-number',
    });

    expect(result).toBe(false);
    expect(validator.getErrors()).toMatchObject({
      auth_date: 'NOT_POSITIVE_INTEGER',
    });
  });

  it('strips fields not declared in the schema (LIVR whitelist behavior)', () => {
    const validator = new LIVR.Validator(TELEGRAM_LOGIN_PAYLOAD_SCHEMA);

    const result = validator.validate({
      ...VALID_PAYLOAD,
      unexpected_field: 'should not survive validation',
    });

    // LIVR only copies fields explicitly declared in the schema onto the
    // validated result — it does not error on unknown fields, it silently
    // drops them. Pinning this so a future LIVR upgrade doesn't start
    // either rejecting unknown fields or, worse, passing them through.
    expect(result).not.toBe(false);
    expect(result).not.toHaveProperty('unexpected_field');
    expect(result).toEqual(VALID_PAYLOAD);
  });
});
