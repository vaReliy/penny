import type { UserStatus } from 'identity-core';

/**
 * Claims encoded into every session token. Kept minimal and stateless —
 * the platform never persists a server-side session record: a
 * middleware re-loads the user from the DB on each request using `sub` to
 * enforce the live `status` gate, rather than trusting `status`/`roles`
 * from an old token.
 */
export interface TokenClaims {
  /** Subject — the {@link User.id} this token was issued for. */
  readonly sub: string;
  readonly status: UserStatus;
  readonly roles: readonly string[];
}

/**
 * Seam between `application` services and the concrete JWT/session-token
 * implementation. Callers (e.g. `LoginWithTelegramService`) depend only on
 * this interface, never on `jsonwebtoken` directly, so a future refresh-token
 * rotation scheme can be introduced behind the same seam without touching
 * any caller.
 */
export interface ITokenIssuer {
  /** Issues a signed, stateless token encoding `claims`. */
  issue(claims: TokenClaims): string;

  /**
   * Verifies `token`'s signature and expiry, returning the encoded claims.
   *
   * @throws {AuthenticationError} If the token is invalid, malformed, or expired.
   */
  verify(token: string): TokenClaims;
}
