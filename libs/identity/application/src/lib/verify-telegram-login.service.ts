import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

import { AuthenticationError } from 'shared-errors';
import { BaseService } from 'shared-kernel';
import { TELEGRAM_LOGIN_PAYLOAD_SCHEMA } from 'shared-validation';
import type { TelegramLoginPayload } from 'shared-contracts';
import type { ServiceContext } from 'shared-kernel';

/** Raw payload shape received from the Telegram Login Widget on the wire. */
export interface RawTelegramLoginPayload {
  readonly id: number;
  readonly auth_date: number;
  readonly hash: string;
  readonly first_name?: string;
  readonly last_name?: string;
  readonly username?: string;
  readonly photo_url?: string;
}

/** Config slice this service needs from `ServiceContext.config`. */
export interface VerifyTelegramLoginConfig {
  readonly telegramBotToken: string;
}

/** Number of seconds in a day, used to derive the payload freshness window. */
const SECONDS_PER_DAY = 86_400;

/**
 * Maximum age, in seconds, a Telegram Login Widget payload may have before
 * it is rejected as stale. Telegram recommends checking `auth_date` is
 * recent to mitigate replay of an intercepted/leaked payload.
 */
const MAX_AUTH_DATE_AGE_SECONDS = SECONDS_PER_DAY;

/** Field excluded from the HMAC data-check-string per the Telegram spec. */
const HASH_FIELD = 'hash';

/** Message used when the computed HMAC does not match the payload's `hash`. */
const VERIFICATION_FAILED_MESSAGE =
  'Telegram login verification failed: hash mismatch.';

/** Message used when the payload's `auth_date` is older than the allowed window. */
const STALE_PAYLOAD_MESSAGE =
  'Telegram login verification failed: payload is stale.';

/**
 * Verifies a Telegram Login Widget payload is genuinely from Telegram
 * before any user is created/looked up.
 *
 * Framework-free `application` service — no DI decorators. The bot token is
 * read exclusively from `ServiceContext.config`, never from `process.env`,
 * so the interface layer (HTTP controller/CLI/queue worker bootstrap) owns
 * all secret sourcing.
 *
 * @see https://core.telegram.org/widgets/login
 */
export class VerifyTelegramLoginService extends BaseService<
  RawTelegramLoginPayload,
  TelegramLoginPayload
> {
  protected override getValidationSchema(): Record<string, unknown> {
    return TELEGRAM_LOGIN_PAYLOAD_SCHEMA;
  }

  protected override execute(
    params: RawTelegramLoginPayload,
    context: ServiceContext<VerifyTelegramLoginConfig>,
  ): TelegramLoginPayload {
    // Signature check first: a forged-but-stale payload must fail with the
    // same "verification failed" error as any other forged payload, never
    // leaking that it was stale (which would tell a forging caller their
    // signature wasn't even checked yet).
    this.assertHashMatches(params, context.config.telegramBotToken);
    this.assertFresh(params.auth_date);

    return {
      id: params.id,
      // Defensive fallback only: `first_name` is optional in the LIVR schema
      // and `RawTelegramLoginPayload`, but Telegram's widget always sends it
      // in practice — this default does not reflect an expected gap.
      firstName: params.first_name ?? '',
      lastName: params.last_name,
      username: params.username,
      photoUrl: params.photo_url,
      authDate: params.auth_date,
      hash: params.hash,
    };
  }

  /** Rejects payloads whose `auth_date` is older than the allowed window. */
  private assertFresh(authDate: number): void {
    const nowSeconds = Math.floor(Date.now() / 1000);

    if (nowSeconds - authDate > MAX_AUTH_DATE_AGE_SECONDS) {
      throw new AuthenticationError(STALE_PAYLOAD_MESSAGE);
    }
  }

  /**
   * Recomputes the HMAC-SHA256 over the data-check-string and compares it to
   * `payload.hash` using a constant-time comparison, per the Telegram spec.
   */
  private assertHashMatches(
    payload: RawTelegramLoginPayload,
    botToken: string,
  ): void {
    const secret = createHash('sha256').update(botToken).digest();
    const dataCheckString = this.buildDataCheckString(payload);
    const computedHash = createHmac('sha256', secret)
      .update(dataCheckString)
      .digest('hex');

    const computedBuffer = Buffer.from(computedHash, 'utf8');
    const providedBuffer = Buffer.from(payload.hash, 'utf8');

    const isValid =
      computedBuffer.length === providedBuffer.length &&
      timingSafeEqual(computedBuffer, providedBuffer);

    if (!isValid) {
      throw new AuthenticationError(VERIFICATION_FAILED_MESSAGE);
    }
  }

  /**
   * Builds the Telegram data-check-string: every payload field except
   * `hash`, sorted alphabetically by key, joined as `key=value` with `\n`.
   */
  private buildDataCheckString(payload: RawTelegramLoginPayload): string {
    return Object.entries(payload)
      .filter(([key]) => key !== HASH_FIELD)
      .filter(([, value]) => value !== undefined)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([key, value]) => `${key}=${String(value)}`)
      .join('\n');
  }
}
