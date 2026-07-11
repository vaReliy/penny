import jwt from 'jsonwebtoken';
import { AuthenticationError } from 'shared-errors';
import { UserStatus } from 'identity-core';
import { Role } from 'shared-contracts';
import { describe, expect, it } from 'vitest';

import { JwtTokenIssuer } from './jwt-token-issuer.js';
import type { TokenClaims } from './token-issuer.js';

/** Deterministic test-only HS256 secret. Never a real production secret. */
const TEST_SECRET = 'test-jwt-secret-do-not-use-in-prod';

/** A second deterministic test-only secret, distinct from `TEST_SECRET`. */
const OTHER_TEST_SECRET = 'a-different-test-secret-also-32-chars-plus';

const CLAIMS: TokenClaims = {
  sub: 'user-1',
  status: UserStatus.ACTIVE,
  roles: [Role.USER],
};

describe('JwtTokenIssuer', () => {
  it('issues a token that verifies and carries sub + status + roles', () => {
    const issuer = new JwtTokenIssuer(TEST_SECRET);

    const token = issuer.issue(CLAIMS);
    const verified = issuer.verify(token);

    expect(verified).toEqual(CLAIMS);
  });

  it('signs with HS256 and includes an exp claim', () => {
    const issuer = new JwtTokenIssuer(TEST_SECRET);

    const token = issuer.issue(CLAIMS);
    const decoded = jwt.decode(token, { complete: true });

    expect(decoded?.header.alg).toBe('HS256');
    expect(typeof (decoded?.payload as { exp?: number }).exp).toBe('number');
  });

  it('rejects a token signed with a different secret', () => {
    const issuer = new JwtTokenIssuer(TEST_SECRET);
    const otherIssuer = new JwtTokenIssuer(OTHER_TEST_SECRET);

    const token = issuer.issue(CLAIMS);

    expect(() => otherIssuer.verify(token)).toThrow(AuthenticationError);
  });

  it('rejects an expired token', () => {
    // expiresInSeconds=-1 produces an exp claim already in the past, so
    // verify() exercises jsonwebtoken's own expiry check rather than this
    // class re-implementing clock comparison.
    const issuer = new JwtTokenIssuer(TEST_SECRET, -1);

    const token = issuer.issue(CLAIMS);

    expect(() => issuer.verify(token)).toThrow(AuthenticationError);
  });

  it('rejects a malformed token string', () => {
    const issuer = new JwtTokenIssuer(TEST_SECRET);

    expect(() => issuer.verify('not-a-jwt')).toThrow(AuthenticationError);
  });

  it('rejects a token signed with an unexpected algorithm (alg confusion guard)', () => {
    const issuer = new JwtTokenIssuer(TEST_SECRET);
    const noneAlgToken = jwt.sign(
      { status: CLAIMS.status, roles: CLAIMS.roles },
      TEST_SECRET,
      { subject: CLAIMS.sub, algorithm: 'HS384' },
    );

    expect(() => issuer.verify(noneAlgToken)).toThrow(AuthenticationError);
  });

  it('rejects a validly-signed token whose status claim is not a real UserStatus value', () => {
    const issuer = new JwtTokenIssuer(TEST_SECRET);
    // Signed with the correct secret/algorithm, but `status` is garbage —
    // isTokenClaims must reject this even though the signature is valid.
    const tokenWithBogusStatus = jwt.sign(
      { status: 'super-admin', roles: CLAIMS.roles },
      TEST_SECRET,
      { subject: CLAIMS.sub, algorithm: 'HS256' },
    );

    expect(() => issuer.verify(tokenWithBogusStatus)).toThrow(
      AuthenticationError,
    );
  });

  it('throws when constructed with a secret shorter than the minimum length', () => {
    expect(() => new JwtTokenIssuer('too-short-secret')).toThrow();
  });

  it('rejects a validly-signed token whose roles claim contains an unknown role value', () => {
    const issuer = new JwtTokenIssuer(TEST_SECRET);
    // Signed with the correct secret/algorithm, but `roles` contains an
    // unregistered value — isTokenClaims must reject this even though the
    // signature is valid.
    const tokenWithBogusRole = jwt.sign(
      { status: CLAIMS.status, roles: ['owner'] },
      TEST_SECRET,
      { subject: CLAIMS.sub, algorithm: 'HS256' },
    );

    expect(() => issuer.verify(tokenWithBogusRole)).toThrow(
      AuthenticationError,
    );
  });

  it('encodes the Role.USER string literal into the roles claim', () => {
    const issuer = new JwtTokenIssuer(TEST_SECRET);
    const token = issuer.issue(CLAIMS);
    const decoded = jwt.decode(token) as { roles?: unknown };

    expect(decoded?.roles).toEqual(['user']);
  });

  it('encodes the Role.SUPERADMIN string literal into the roles claim', () => {
    const issuer = new JwtTokenIssuer(TEST_SECRET);
    const superadminClaims: TokenClaims = {
      ...CLAIMS,
      roles: [Role.SUPERADMIN],
    };

    const token = issuer.issue(superadminClaims);
    const decoded = jwt.decode(token) as { roles?: unknown };

    expect(decoded?.roles).toEqual(['superadmin']);
  });
});
