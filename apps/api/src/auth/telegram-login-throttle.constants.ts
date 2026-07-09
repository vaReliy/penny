/** Sliding time window for the Telegram login rate limit, in milliseconds. */
export const TELEGRAM_LOGIN_THROTTLE_TTL_MS = 60_000;

/** Max `POST /api/auth/telegram` requests allowed per IP within the throttle window. */
export const TELEGRAM_LOGIN_THROTTLE_LIMIT = 10;
