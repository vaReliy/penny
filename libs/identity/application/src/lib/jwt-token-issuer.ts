import jwt from 'jsonwebtoken';

import { AuthenticationError } from 'shared-errors';
import { UserStatus } from 'shared-contracts';

import type { ITokenIssuer, TokenClaims } from './token-issuer.js';

/**
 * Default token lifetime, in seconds, applied when a {@link JwtTokenIssuer}
 * is constructed without an explicit `expiresInSeconds` — one hour.
 */
export const DEFAULT_TOKEN_TTL_SECONDS = 3_600;

/**
 * Minimum byte length required of the HS256 signing secret. Short secrets
 * are brute-forceable offline once an attacker has a single valid
 * signature; 32 bytes (256 bits) matches the HS256 output size.
 */
export const MIN_SECRET_LENGTH = 32;

/** Message used when `jsonwebtoken` rejects a token at `verify` time. */
const INVALID_TOKEN_MESSAGE = 'Session token is invalid or has expired.';

/** Message used when a verified token's payload does not match {@link TokenClaims}. */
const MALFORMED_CLAIMS_MESSAGE = 'Session token payload is malformed.';

/** Set of valid `UserStatus` values, used to validate a decoded token's `status` claim. */
const VALID_USER_STATUSES: ReadonlySet<string> = new Set(
  Object.values(UserStatus),
);

/** Narrows an unknown decoded JWT payload down to the platform's {@link TokenClaims} shape. */
function isTokenClaims(payload: unknown): payload is TokenClaims {
  if (typeof payload !== 'object' || payload === null) {
    return false;
  }

  const candidate = payload as Record<string, unknown>;

  return (
    typeof candidate['sub'] === 'string' &&
    typeof candidate['status'] === 'string' &&
    VALID_USER_STATUSES.has(candidate['status']) &&
    Array.isArray(candidate['roles']) &&
    candidate['roles'].every((role) => typeof role === 'string')
  );
}

/**
 * HS256 {@link ITokenIssuer} implementation backed by the `jsonwebtoken`
 * package. Produces a stateless token — `sub`, `status`, `roles`, and a
 * `jsonwebtoken`-managed `exp` claim — with no server-side session record
 * The signing secret is supplied by the constructor caller, which
 * must source it from `ServiceContext.config`, never from `process.env`
 * directly, keeping this class itself free of any config-loading concern.
 */
export class JwtTokenIssuer implements ITokenIssuer {
  private readonly secret: string;
  private readonly expiresInSeconds: number;

  public constructor(
    secret: string,
    expiresInSeconds: number = DEFAULT_TOKEN_TTL_SECONDS,
  ) {
    if (secret.length < MIN_SECRET_LENGTH) {
      throw new Error(
        `JwtTokenIssuer secret must be at least ${MIN_SECRET_LENGTH} characters long.`,
      );
    }

    this.secret = secret;
    this.expiresInSeconds = expiresInSeconds;
  }

  public issue(claims: TokenClaims): string {
    return jwt.sign(
      { status: claims.status, roles: claims.roles },
      this.secret,
      {
        subject: claims.sub,
        algorithm: 'HS256',
        expiresIn: this.expiresInSeconds,
      },
    );
  }

  public verify(token: string): TokenClaims {
    let decoded: unknown;

    try {
      decoded = jwt.verify(token, this.secret, { algorithms: ['HS256'] });
    } catch {
      throw new AuthenticationError(INVALID_TOKEN_MESSAGE);
    }

    if (!isTokenClaims(decoded)) {
      throw new AuthenticationError(MALFORMED_CLAIMS_MESSAGE);
    }

    return {
      sub: decoded.sub,
      status: decoded.status as UserStatus,
      roles: decoded.roles,
    };
  }
}
