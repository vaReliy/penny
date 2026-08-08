/**
 * LIVR schema for the raw Telegram Login Widget payload, as received from
 * the client before HMAC verification. Field names follow the widget's own
 * wire format (snake_case `auth_date`/`first_name`/etc.), not the camelCase
 * `TelegramLoginPayload` contract used after verification.
 *
 * @see https://core.telegram.org/widgets/login
 */
export const TELEGRAM_LOGIN_PAYLOAD_SCHEMA: Record<string, unknown> = {
  id: ['required', 'positive_integer'],
  auth_date: ['required', 'positive_integer'],
  hash: ['required', 'string'],
  first_name: ['string'],
  last_name: ['string'],
  username: ['string'],
  photo_url: ['string'],
};
