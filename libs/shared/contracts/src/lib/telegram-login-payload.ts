/**
 * Payload received from the Telegram Login Widget on the client, sent to
 * the server to be verified (HMAC check against the bot token) and
 * exchanged for a session. Types-only — verification logic lives in the
 * auth integration, not here.
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
