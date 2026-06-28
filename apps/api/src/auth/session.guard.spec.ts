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

  it('clears cookie and throws AuthenticationError when user is rejected', async () => {
    (userRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeUser({ status: UserStatus.REJECTED }),
    );
    const { ctx, clearCookie } = makeContext(`${AUTH_COOKIE_NAME}=valid-jwt`);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      AuthenticationError,
    );
    expect(clearCookie).toHaveBeenCalledWith(AUTH_COOKIE_NAME, { path: '/' });
    expect(clearCookie).toHaveBeenCalledWith(XSRF_COOKIE_NAME, { path: '/' });
  });

  it('clears cookie and throws AuthenticationError when user is pending', async () => {
    (userRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeUser({ status: UserStatus.PENDING }),
    );
    const { ctx, clearCookie } = makeContext(`${AUTH_COOKIE_NAME}=valid-jwt`);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      AuthenticationError,
    );
    expect(clearCookie).toHaveBeenCalledWith(AUTH_COOKIE_NAME, { path: '/' });
    expect(clearCookie).toHaveBeenCalledWith(XSRF_COOKIE_NAME, { path: '/' });
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
    });
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
