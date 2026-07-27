import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@nestjs/common', () => ({
  Controller: () => () => undefined,
  Get: () => () => undefined,
  Inject: () => () => undefined,
  UseGuards: () => () => undefined,
  Injectable: () => () => undefined,
  Logger: class {
    error(): void {
      /* noop */
    }
  },
  createParamDecorator: () => () => () => undefined,
}));

import type { ExecutionContext } from '@nestjs/common';
import { AuthenticationError } from 'shared-errors';
import { UserStatus } from 'shared-contracts';
import { GetExchangeRatesService } from 'budget-infrastructure';
import type { IExchangeRateClient } from 'budget-infrastructure';
import type { ExchangeRatesResponse } from 'budget-contracts';
import { createFakeUserRepository } from 'identity-testing';
import type { SessionUser } from 'shared-contracts';
import type { ITokenIssuer } from 'identity-application';
import type { IUserRepository } from 'identity-core';

import { SessionGuard } from '../auth/session.guard.js';
import { ActiveUserGuard } from '../auth/active-user.guard.js';
import { AUTH_COOKIE_NAME } from '../auth/cookie.constants.js';
import { RatesController } from './rates.controller.js';

const FAKE_RATES: ExchangeRatesResponse = {
  base: 'UAH',
  rates: [{ currency: 'USD', rateToBase: '41.5000' }],
  asOf: '2026-07-20T00:00:00.000Z',
};

function makeContext(cookieHeader?: string): {
  ctx: ExecutionContext;
  getReqUser: () => unknown;
} {
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
  const res = { clearCookie: vi.fn() };
  const getRequest = vi.fn().mockReturnValue(req);
  const getResponse = vi.fn().mockReturnValue(res);
  const switchToHttp = vi.fn().mockReturnValue({ getRequest, getResponse });
  const ctx = { switchToHttp } as unknown as ExecutionContext;
  return { ctx, getReqUser: () => reqUser };
}

function makeSessionRepoUser(
  overrides: Partial<{ id: string; status: string }> = {},
) {
  return {
    id: 'user-1',
    telegramId: '123456',
    firstName: 'Alice',
    username: 'alice',
    status: UserStatus.ACTIVE,
    ...overrides,
  };
}

describe('RatesController (real SessionGuard/ActiveUserGuard in the chain)', () => {
  let tokenIssuer: ITokenIssuer;
  let sessionUserRepository: IUserRepository;
  let sessionGuard: SessionGuard;
  let activeUserGuard: ActiveUserGuard;
  let fakeClient: IExchangeRateClient;
  let controller: RatesController;

  beforeEach(() => {
    tokenIssuer = {
      issue: vi.fn(),
      verify: vi.fn(),
    } as unknown as ITokenIssuer;

    sessionUserRepository = createFakeUserRepository({
      findById: vi.fn().mockResolvedValue(makeSessionRepoUser()),
    });

    sessionGuard = new SessionGuard(tokenIssuer, sessionUserRepository);
    activeUserGuard = new ActiveUserGuard();

    // No live Monobank calls in tests — a fake client stands in for the
    // upstream HTTP dependency, exercising only the cache/serving behavior
    // `GetExchangeRatesService` owns.
    fakeClient = { fetchRates: vi.fn().mockResolvedValue(FAKE_RATES) };

    controller = new RatesController(new GetExchangeRatesService(fakeClient));
  });

  async function authenticate(
    status: string = UserStatus.ACTIVE,
  ): Promise<SessionUser> {
    (tokenIssuer.verify as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'user-1',
      status,
      roles: [],
    });
    (
      sessionUserRepository.findById as ReturnType<typeof vi.fn>
    ).mockResolvedValue(makeSessionRepoUser({ status }));
    const { ctx, getReqUser } = makeContext(`${AUTH_COOKIE_NAME}=valid-jwt`);
    await sessionGuard.canActivate(ctx);
    return getReqUser() as SessionUser;
  }

  it('SessionGuard throws the same opaque AuthenticationError with no auth cookie', async () => {
    const { ctx } = makeContext(undefined);
    await expect(sessionGuard.canActivate(ctx)).rejects.toBeInstanceOf(
      AuthenticationError,
    );
  });

  it('ActiveUserGuard denies a pending caller', () => {
    const user: SessionUser = {
      id: 'user-1',
      telegramId: '999',
      displayName: 'User',
      status: UserStatus.PENDING,
      roles: [],
    };
    const req = { user };
    const getRequest = vi.fn().mockReturnValue(req);
    const switchToHttp = vi.fn().mockReturnValue({ getRequest });
    const ctx = { switchToHttp } as unknown as ExecutionContext;

    expect(() => activeUserGuard.canActivate(ctx)).toThrow();
  });

  it('returns rates served from the cache — the upstream client is called at most once for two calls within the TTL', async () => {
    await authenticate();

    const first = await controller.get();
    const second = await controller.get();

    expect(first).toEqual(FAKE_RATES);
    expect(second).toEqual(FAKE_RATES);
    expect(fakeClient.fetchRates).toHaveBeenCalledOnce();
  });
});
