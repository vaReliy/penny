import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@nestjs/common', () => ({
  Injectable: () => () => undefined,
  Inject: () => () => undefined,
}));

import { SessionGuard } from './session.guard.js';
import { AUTH_COOKIE_NAME, XSRF_COOKIE_NAME } from './cookie.constants.js';
import { AuthenticationError } from 'shared-errors';
import { UserStatus } from 'identity-core';
import type { ExecutionContext } from '@nestjs/common';
import type { ITokenIssuer } from 'identity-application';
import type { IUserRepository, User } from 'identity-core';

function makeContext(cookieHeader?: string): {
  ctx: ExecutionContext;
  getReqUser: () => unknown;
  setReqUser: (u: unknown) => void;
  clearCookie: ReturnType<typeof vi.fn>;
} {
  const clearCookie = vi.fn();

  let reqUser: unknown;
  const req = {
    headers: { cookie: cookieHeader },
    get user() {
      return reqUser;
    },
    set user(v: unknown) {
      reqUser = v;
    },
  };

  const res = { clearCookie };

  const getRequest = vi.fn().mockReturnValue(req);
  const getResponse = vi.fn().mockReturnValue(res);
  const switchToHttp = vi.fn().mockReturnValue({ getRequest, getResponse });

  const ctx = { switchToHttp } as unknown as ExecutionContext;

  return {
    ctx,
    getReqUser: () => reqUser,
    setReqUser: (v) => {
      reqUser = v;
    },
    clearCookie,
  };
}

function makeUser(
  overrides: Partial<{
    id: string;
    telegramId: string;
    firstName: string | undefined;
    username: string | undefined;
    status: string;
  }> = {},
): User {
  const props = {
    id: 'user-1',
    telegramId: '123456',
    firstName: 'Alice' as string | undefined,
    username: 'alice' as string | undefined,
    status: UserStatus.ACTIVE,
    ...overrides,
  };
  return props as unknown as User;
}

describe('SessionGuard.canActivate', () => {
  let tokenIssuer: ITokenIssuer;
  let userRepository: IUserRepository;
  let guard: SessionGuard;

  beforeEach(() => {
    tokenIssuer = {
      issue: vi.fn(),
      verify: vi
        .fn()
        .mockReturnValue({ sub: 'user-1', status: 'active', roles: [] }),
    } as unknown as ITokenIssuer;

    userRepository = {
      findById: vi.fn().mockResolvedValue(makeUser()),
    } as unknown as IUserRepository;

    guard = new SessionGuard(tokenIssuer, userRepository);
  });

  it('throws AuthenticationError when no cookie header', async () => {
    const { ctx } = makeContext(undefined);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      AuthenticationError,
    );
  });

  it('throws a no-arg AuthenticationError (opaque default message, no token-state detail) when no cookie header', async () => {
    const { ctx } = makeContext(undefined);

    let caught: unknown;
    try {
      await guard.canActivate(ctx);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(AuthenticationError);
    expect((caught as AuthenticationError).message).not.toMatch(
      /missing|cookie/i,
    );
  });

  it('throws AuthenticationError when cookie header has no token cookie', async () => {
    const { ctx } = makeContext('other=value');
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      AuthenticationError,
    );
  });

  it('clears cookie and throws AuthenticationError when tokenIssuer.verify throws', async () => {
    (tokenIssuer.verify as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('invalid jwt');
    });
    const { ctx, clearCookie } = makeContext(`${AUTH_COOKIE_NAME}=bad-jwt`);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      AuthenticationError,
    );
    expect(clearCookie).toHaveBeenCalledWith(AUTH_COOKIE_NAME, { path: '/' });
    expect(clearCookie).toHaveBeenCalledWith(XSRF_COOKIE_NAME, { path: '/' });
  });

  it('throws a no-arg AuthenticationError (opaque default message, no token-state detail) when tokenIssuer.verify throws', async () => {
    (tokenIssuer.verify as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('jwt expired');
    });
    const { ctx } = makeContext(`${AUTH_COOKIE_NAME}=bad-jwt`);

    let caught: unknown;
    try {
      await guard.canActivate(ctx);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(AuthenticationError);
    expect((caught as AuthenticationError).message).not.toMatch(
      /expired|invalid|token/i,
    );
  });

  it('clears cookie and throws AuthenticationError when user not found', async () => {
    (userRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      null,
    );
    const { ctx, clearCookie } = makeContext(`${AUTH_COOKIE_NAME}=valid-jwt`);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      AuthenticationError,
    );
    expect(clearCookie).toHaveBeenCalledWith(AUTH_COOKIE_NAME, { path: '/' });
    expect(clearCookie).toHaveBeenCalledWith(XSRF_COOKIE_NAME, { path: '/' });
  });

  it('throws a no-arg AuthenticationError (opaque default message, no token-state detail) when user not found', async () => {
    (userRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      null,
    );
    const { ctx } = makeContext(`${AUTH_COOKIE_NAME}=valid-jwt`);

    let caught: unknown;
    try {
      await guard.canActivate(ctx);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(AuthenticationError);
    expect((caught as AuthenticationError).message).not.toMatch(
      /denied|access|not found/i,
    );
  });

  it('returns true and sets req.user for a PENDING user — SessionGuard does not check status', async () => {
    const user = makeUser({
      id: 'u-pending',
      telegramId: '888',
      firstName: 'Pending',
      status: UserStatus.PENDING,
    });
    (userRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      user,
    );
    const { ctx, getReqUser } = makeContext(`${AUTH_COOKIE_NAME}=valid-jwt`);

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(getReqUser()).toMatchObject({ status: UserStatus.PENDING });
  });

  it("returns true and sets req.user for a REJECTED user — status check is ActiveUserGuard's job", async () => {
    const user = makeUser({
      id: 'u-rejected',
      telegramId: '999',
      firstName: 'Rejected',
      status: UserStatus.REJECTED,
    });
    (userRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      user,
    );
    const { ctx, getReqUser } = makeContext(`${AUTH_COOKIE_NAME}=valid-jwt`);

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(getReqUser()).toMatchObject({ status: UserStatus.REJECTED });
  });

  it('returns true and sets req.user for a valid active user', async () => {
    const user = makeUser({
      id: 'u1',
      telegramId: '999',
      firstName: 'Alice',
      status: UserStatus.ACTIVE,
    });
    (userRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      user,
    );
    const { ctx, getReqUser } = makeContext(`${AUTH_COOKIE_NAME}=valid-jwt`);

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(getReqUser()).toEqual({
      id: 'u1',
      telegramId: '999',
      displayName: 'Alice',
      status: UserStatus.ACTIVE,
      roles: [],
    });
  });

  it('populates req.user.roles from claims.roles (multiple roles)', async () => {
    (tokenIssuer.verify as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'user-1',
      status: 'active',
      roles: ['admin', 'user'],
    });
    const user = makeUser({ id: 'u2', telegramId: '222' });
    (userRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      user,
    );
    const { ctx, getReqUser } = makeContext(`${AUTH_COOKIE_NAME}=valid-jwt`);

    await guard.canActivate(ctx);

    expect((getReqUser() as { roles: readonly string[] }).roles).toEqual([
      'admin',
      'user',
    ]);
  });

  it('populates req.user.roles as an empty array when claims.roles is empty', async () => {
    (tokenIssuer.verify as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'user-1',
      status: 'active',
      roles: [],
    });
    const user = makeUser({ id: 'u3', telegramId: '333' });
    (userRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      user,
    );
    const { ctx, getReqUser } = makeContext(`${AUTH_COOKIE_NAME}=valid-jwt`);

    await guard.canActivate(ctx);

    expect((getReqUser() as { roles: readonly string[] }).roles).toEqual([]);
  });

  it('falls back displayName to username when firstName is undefined', async () => {
    const user = makeUser({
      firstName: undefined,
      username: 'bob_tg',
      telegramId: '777',
    });
    (userRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      user,
    );
    const { ctx, getReqUser } = makeContext(`${AUTH_COOKIE_NAME}=valid-jwt`);

    await guard.canActivate(ctx);

    expect((getReqUser() as { displayName: string }).displayName).toBe(
      'bob_tg',
    );
  });

  it('falls back displayName to telegramId when both firstName and username are undefined', async () => {
    const user = makeUser({
      firstName: undefined,
      username: undefined,
      telegramId: '555',
    });
    (userRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      user,
    );
    const { ctx, getReqUser } = makeContext(`${AUTH_COOKIE_NAME}=valid-jwt`);

    await guard.canActivate(ctx);

    expect((getReqUser() as { displayName: string }).displayName).toBe('555');
  });
});
