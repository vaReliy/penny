import { createHash, createHmac } from 'node:crypto';

import { AuthenticationError } from 'shared-errors';
import { ServiceValidationError } from 'shared-kernel';
import { describe, expect, it } from 'vitest';

import {
  VerifyTelegramLoginService,
  type VerifyTelegramLoginConfig,
} from './verify-telegram-login.service.js';
import type { RawTelegramLoginPayload } from 'shared-contracts';
import type { ServiceContext } from 'shared-kernel';

/**
 * Deterministic test-only bot token. Never a real Telegram bot token —
 * used purely to make the HMAC fixture below reproducible.
 */
const TEST_BOT_TOKEN = 'test-bot-token-do-not-use-in-prod';

/** Number of seconds in a day, mirrors the service's freshness window. */
const SECONDS_PER_DAY = 86_400;

const CONTEXT: ServiceContext<VerifyTelegramLoginConfig> = {
  config: { telegramBotToken: TEST_BOT_TOKEN },
  caller: null,
};

/** Builds the Telegram data-check-string the same way the service does. */
function buildDataCheckString(
  payload: Omit<RawTelegramLoginPayload, 'hash'>,
): string {
  return Object.entries(payload)
    .filter(([, value]) => value !== undefined)
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join('\n');
}

/** Computes the HMAC-SHA256 hex digest a genuine Telegram payload would carry. */
function computeHash(
  payload: Omit<RawTelegramLoginPayload, 'hash'>,
  botToken: string,
): string {
  const secret = createHash('sha256').update(botToken).digest();
  const dataCheckString = buildDataCheckString(payload);

  return createHmac('sha256', secret).update(dataCheckString).digest('hex');
}

/** Builds a valid, correctly-signed payload fixture, with optional overrides. */
function buildValidPayload(
  overrides: Partial<Omit<RawTelegramLoginPayload, 'hash'>> = {},
): RawTelegramLoginPayload {
  const base: Omit<RawTelegramLoginPayload, 'hash'> = {
    id: 123456789,
    auth_date: Math.floor(Date.now() / 1000),
    first_name: 'Ada',
    last_name: 'Lovelace',
    username: 'ada',
    photo_url: 'https://example.com/ada.png',
    ...overrides,
  };

  return { ...base, hash: computeHash(base, TEST_BOT_TOKEN) };
}

describe('VerifyTelegramLoginService', () => {
  it('returns the verified, typed payload for a correctly-signed, fresh payload', async () => {
    const service = new VerifyTelegramLoginService();
    const payload = buildValidPayload();

    const outcome = await service.run(payload, CONTEXT);

    expect(outcome).toEqual({
      data: {
        id: payload.id,
        firstName: 'Ada',
        lastName: 'Lovelace',
        username: 'ada',
        photoUrl: 'https://example.com/ada.png',
        authDate: payload.auth_date,
        hash: payload.hash,
      },
    });
  });

  it('rejects a payload whose hash has been tampered with', async () => {
    const service = new VerifyTelegramLoginService();
    const payload = buildValidPayload();
    const tampered: RawTelegramLoginPayload = {
      ...payload,
      hash: `${payload.hash.slice(0, -1)}${payload.hash.endsWith('0') ? '1' : '0'}`,
    };

    await expect(service.run(tampered, CONTEXT)).rejects.toMatchObject({
      constructor: AuthenticationError,
      message: 'Telegram login verification failed: hash mismatch.',
    });
  });

  it('rejects a payload with a hash of different length than expected', async () => {
    const service = new VerifyTelegramLoginService();
    const payload = buildValidPayload();
    const tampered: RawTelegramLoginPayload = {
      ...payload,
      hash: `${payload.hash}ff`,
    };

    await expect(service.run(tampered, CONTEXT)).rejects.toBeInstanceOf(
      AuthenticationError,
    );
  });

  it('rejects a payload whose first_name was mutated after signing', async () => {
    const service = new VerifyTelegramLoginService();
    const payload = buildValidPayload();
    const mutated: RawTelegramLoginPayload = {
      ...payload,
      first_name: 'Eve',
    };

    await expect(service.run(mutated, CONTEXT)).rejects.toBeInstanceOf(
      AuthenticationError,
    );
  });

  it('rejects a payload whose id was mutated after signing', async () => {
    const service = new VerifyTelegramLoginService();
    const payload = buildValidPayload();
    const mutated: RawTelegramLoginPayload = {
      ...payload,
      id: payload.id + 1,
    };

    await expect(service.run(mutated, CONTEXT)).rejects.toBeInstanceOf(
      AuthenticationError,
    );
  });

  it('rejects a payload whose auth_date is older than 24 hours', async () => {
    const service = new VerifyTelegramLoginService();
    const staleAuthDate = Math.floor(Date.now() / 1000) - SECONDS_PER_DAY - 60;
    const payload = buildValidPayload({ auth_date: staleAuthDate });

    await expect(service.run(payload, CONTEXT)).rejects.toMatchObject({
      constructor: AuthenticationError,
      message: 'Telegram login verification failed: payload is stale.',
    });
  });

  it('rejects a forged-and-stale payload with the hash-mismatch message, not the staleness one', async () => {
    // Regression guard for check ordering: the signature check must run
    // before the freshness check, so a forged payload never gets far enough
    // to reveal it was also stale.
    const service = new VerifyTelegramLoginService();
    const staleAuthDate = Math.floor(Date.now() / 1000) - SECONDS_PER_DAY - 60;
    const payload = buildValidPayload({ auth_date: staleAuthDate });
    const forgedAndStale: RawTelegramLoginPayload = {
      ...payload,
      hash: `${payload.hash.slice(0, -1)}${payload.hash.endsWith('0') ? '1' : '0'}`,
    };

    await expect(service.run(forgedAndStale, CONTEXT)).rejects.toMatchObject({
      constructor: AuthenticationError,
      message: 'Telegram login verification failed: hash mismatch.',
    });
  });

  it('accepts a payload whose auth_date is just inside the 24-hour window', async () => {
    const service = new VerifyTelegramLoginService();
    const freshAuthDate = Math.floor(Date.now() / 1000) - SECONDS_PER_DAY + 60;
    const payload = buildValidPayload({ auth_date: freshAuthDate });

    const outcome = await service.run(payload, CONTEXT);

    expect(outcome.data.authDate).toBe(freshAuthDate);
  });

  it('rejects a payload signed with a different bot token', async () => {
    const service = new VerifyTelegramLoginService();
    const wrongTokenPayload = buildValidPayload();
    const reSignedWithWrongToken: RawTelegramLoginPayload = {
      ...wrongTokenPayload,
      hash: computeHash(wrongTokenPayload, 'a-different-test-bot-token'),
    };

    await expect(
      service.run(reSignedWithWrongToken, CONTEXT),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('accepts a payload carrying extra unknown fields (LIVR strips them before HMAC)', async () => {
    // Regression guard for L2: buildDataCheckString uses Object.entries(payload)
    // where payload is the LIVR-validated output. LIVR only copies schema-declared
    // fields into its result object, so any extra wire fields are stripped before
    // execute() runs — they never reach the data-check-string.
    // If this test fails, unknown fields are leaking into the HMAC input.
    const service = new VerifyTelegramLoginService();
    const payload = buildValidPayload();
    const withExtra = {
      ...payload,
      extra_field: 'injected',
    } as RawTelegramLoginPayload;

    const outcome = await service.run(withExtra, CONTEXT);

    expect(outcome.data.id).toBe(payload.id);
    expect(outcome.data).not.toHaveProperty('extra_field');
  });

  it('rejects a payload missing the required hash field at the LIVR boundary', async () => {
    const service = new VerifyTelegramLoginService();
    const fullPayload = buildValidPayload();
    const { hash, ...withoutHash } = fullPayload;
    // `hash` is intentionally destructured off and discarded — this builds a
    // payload that omits it without using the `delete` operator. Referencing
    // it here keeps it from being flagged as unused.
    void hash;

    // This rejects via ServiceValidationError (the LIVR schema boundary
    // inside BaseService.run), not AuthenticationError — a genuinely
    // different failure path than the post-validation checks asserted
    // elsewhere in this file, so it gets its own explicit type assertion.
    await expect(
      service.run(withoutHash as RawTelegramLoginPayload, CONTEXT),
    ).rejects.toBeInstanceOf(ServiceValidationError);
  });
});
