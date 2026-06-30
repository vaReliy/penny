/**
 * Raw payload received from the Telegram Login Widget as-is (snake_case).
 * Sent verbatim from the client to the server for HMAC verification.
 * Types-only — verification logic lives in the auth integration.
 *
 * @see https://core.telegram.org/widgets/login
 */
export interface RawTelegramLoginPayload {
  readonly id: number;
  readonly auth_date: number;
  readonly hash: string;
  readonly first_name?: string;
  readonly last_name?: string;
  readonly username?: string;
  readonly photo_url?: string;
}

/**
 * Normalized (camelCase) representation of the Telegram Login payload,
 * used after the raw payload has been verified and mapped.
 *
 * @see https://core.telegram.org/widgets/login
 */
export interface TelegramLoginPayload {
  readonly id: number;
  readonly firstName: string;
  readonly lastName?: string;
  readonly username?: string;
  readonly photoUrl?: string;
  readonly authDate: number;
  readonly hash: string;
}
