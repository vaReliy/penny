/** Name of the httpOnly session cookie. */
export const AUTH_COOKIE_NAME = 'token';

/** Cookie lifetime in milliseconds — matches the JWT TTL (1 hour). */
export const AUTH_COOKIE_MAX_AGE_MS = 3_600_000;
