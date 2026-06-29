/**
 * Content Security Policy directives applied to all API responses via Helmet.
 *
 * Permits the Telegram Login Widget (script-src, frame-src, img-src) while
 * blocking all other external origins. Exported as a named constant so the
 * directives can be referenced in tests without duplicating the policy.
 */
export const CSP_DIRECTIVES: Record<string, readonly string[]> = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", 'https://telegram.org'],
  frameSrc: ['https://oauth.telegram.org'],
  connectSrc: ["'self'"],
  imgSrc: ["'self'", 'https://t.me', 'https://*.telegram.org', 'data:'],
  styleSrc: ["'self'", "'unsafe-inline'"],
  objectSrc: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
};
