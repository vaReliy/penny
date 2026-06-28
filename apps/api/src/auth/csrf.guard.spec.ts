import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@nestjs/common', () => ({
  Injectable: () => () => undefined,
  ForbiddenException: class ForbiddenException extends Error {
    public readonly status = 403;
    public constructor(message?: string) {
      super(message ?? 'Forbidden');
      this.name = 'ForbiddenException';
    }
  },
}));

import { CsrfGuard } from './csrf.guard.js';
import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { SKIP_CSRF_KEY } from './skip-csrf.decorator.js';

interface FakeRequest {
  method: string;
  headers: Record<string, string | string[] | undefined>;
}

function makeContext(req: FakeRequest): ExecutionContext {
  const getRequest = vi.fn().mockReturnValue(req);
  const switchToHttp = vi.fn().mockReturnValue({ getRequest });
  const getHandler = vi.fn().mockReturnValue(() => undefined);
  const getClass = vi.fn().mockReturnValue(class {});
  return { switchToHttp, getHandler, getClass } as unknown as ExecutionContext;
}

function makeReq(
  method: string,
  opts: {
    headerToken?: string | string[];
    cookieToken?: string;
    cookieHeader?: string;
  } = {},
): FakeRequest {
  const headers: Record<string, string | string[] | undefined> = {};

  if (opts.headerToken !== undefined) {
    headers['x-xsrf-token'] = opts.headerToken;
  }

  if (opts.cookieHeader !== undefined) {
    headers['cookie'] = opts.cookieHeader;
  } else if (opts.cookieToken !== undefined) {
    headers['cookie'] = `XSRF-TOKEN=${encodeURIComponent(opts.cookieToken)}`;
  }

  return { method, headers };
}

describe('CsrfGuard.canActivate', () => {
  let guard: CsrfGuard;
  let mockReflector: Reflector;

  beforeEach(() => {
    mockReflector = {
      getAllAndOverride: vi.fn().mockReturnValue(false),
    } as unknown as Reflector;
    guard = new CsrfGuard(mockReflector);
  });

  // Safe methods — no token check at all

  it('allows GET requests without any CSRF tokens', () => {
    const ctx = makeContext(makeReq('GET'));
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows HEAD requests without any CSRF tokens', () => {
    const ctx = makeContext(makeReq('HEAD'));
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows OPTIONS requests without any CSRF tokens', () => {
    const ctx = makeContext(makeReq('OPTIONS'));
    expect(guard.canActivate(ctx)).toBe(true);
  });

  // Mutation methods — valid token pairs

  it('allows POST when x-xsrf-token header matches XSRF-TOKEN cookie', () => {
    const token = 'abc123secure';
    const ctx = makeContext(
      makeReq('POST', { headerToken: token, cookieToken: token }),
    );
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows DELETE when x-xsrf-token header matches XSRF-TOKEN cookie', () => {
    const token = 'delete-token-xyz';
    const ctx = makeContext(
      makeReq('DELETE', { headerToken: token, cookieToken: token }),
    );
    expect(guard.canActivate(ctx)).toBe(true);
  });

  // Mutation methods — missing / mismatched tokens

  it('throws ForbiddenException on POST when x-xsrf-token header is absent', () => {
    const ctx = makeContext(makeReq('POST', { cookieToken: 'some-token' }));
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException on POST when XSRF-TOKEN cookie is absent', () => {
    const ctx = makeContext(makeReq('POST', { headerToken: 'some-token' }));
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException on POST when header and cookie tokens do not match', () => {
    const ctx = makeContext(
      makeReq('POST', { headerToken: 'token-a', cookieToken: 'token-b' }),
    );
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException on POST when x-xsrf-token is a string array (not a string)', () => {
    // req.headers[name] can be string | string[] | undefined; an array !== string
    const ctx = makeContext(
      makeReq('POST', {
        cookieToken: 'token-value',
        cookieHeader: 'XSRF-TOKEN=token-value',
        headerToken: ['token-value', 'token-value'], // string[] — never === string
      }),
    );
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException on PUT when cookie header is present but XSRF-TOKEN key is absent', () => {
    const ctx = makeContext(
      makeReq('PUT', {
        headerToken: 'tok',
        cookieHeader: 'SESSION=abc; other=val',
      }),
    );
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException on PATCH when no headers are present at all', () => {
    const ctx = makeContext({ method: 'PATCH', headers: {} });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('includes the expected message in the thrown ForbiddenException', () => {
    const ctx = makeContext(makeReq('POST'));
    expect(() => guard.canActivate(ctx)).toThrow(
      'CSRF token missing or invalid.',
    );
  });

  // @SkipCsrf metadata behaviour

  it('returns true immediately on POST when reflector signals skip via SKIP_CSRF_KEY', () => {
    vi.mocked(mockReflector.getAllAndOverride).mockReturnValue(true);
    const ctx = makeContext(makeReq('POST'));
    expect(guard.canActivate(ctx)).toBe(true);
    expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(
      SKIP_CSRF_KEY,
      expect.any(Array),
    );
  });

  it('throws ForbiddenException on POST when reflector returns false and tokens are missing', () => {
    // mockReflector.getAllAndOverride already returns false from beforeEach
    const ctx = makeContext(makeReq('POST'));
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  // Multi-byte header — Buffer.from().length vs string .length diverge

  it('throws ForbiddenException (not crash) when header is 32 two-byte chars and cookie is a 64-char hex token', () => {
    // 'ä'.repeat(32) has .length === 32 but Buffer.from(...).length === 64 (UTF-8 encodes ä as 2 bytes).
    // The cookie is a standard 64-char hex token → cookieBuf.length === 64.
    // Pre-check: 64 === 64 → passes; timingSafeEqual compares content → false → ForbiddenException.
    // Without Buffer.from() the pre-check would have been 32 !== 64 → still ForbiddenException, but
    // timingSafeEqual would never be called. This test guards against a regression where
    // a different attacker-supplied multibyte string could produce a length that matches the cookie
    // buffer, causing timingSafeEqual to run — it must still throw, never crash with RangeError.
    const hexToken = 'a'.repeat(64);
    const ctx = makeContext(
      makeReq('POST', { headerToken: 'ä'.repeat(32), cookieToken: hexToken }),
    );
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
