import { randomBytes } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';

/**
 * Content Security Policy directives applied to all API responses via Helmet.
 *
 * Permits the Telegram Login Widget (script-src, frame-src, img-src) while
 * blocking all other external origins. Exported as a named constant so the
 * directives can be referenced in tests without duplicating the policy.
 *
 * `style-src` does not include `'unsafe-inline'`; per-request cryptographic
 * nonces are injected by `cspMiddleware` instead.
 */
export const CSP_DIRECTIVES: Record<string, readonly string[]> = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", 'https://telegram.org'],
  frameSrc: ['https://oauth.telegram.org'],
  connectSrc: ["'self'"],
  imgSrc: ["'self'", 'https://t.me', 'https://*.telegram.org', 'data:'],
  styleSrc: ["'self'"],
  objectSrc: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
};

/**
 * Per-request CSP middleware. Generates a cryptographic nonce, embeds it in
 * res.locals for downstream consumers, and passes it to Helmet's style-src
 * directive. The nonce must be injected into <meta name="csp-nonce" content="">
 * server-side (via SSR or a proxy sub_filter) before Angular bootstrap can use it.
 */
export function cspMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const nonce = randomBytes(16).toString('base64');
  res.locals['nonce'] = nonce;

  helmet({
    contentSecurityPolicy: {
      directives: {
        ...CSP_DIRECTIVES,
        styleSrc: ["'self'", `'nonce-${nonce}'`],
      },
    },
  })(req, res, next);
}
