import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('shared-contracts', () => ({
  UserStatus: { PENDING: 'pending', ACTIVE: 'active', REJECTED: 'rejected' },
}));

vi.mock('@nestjs/common', () => ({
  Controller: () => () => undefined,
  Post: () => () => undefined,
  Get: () => () => undefined,
  UseGuards: () => () => undefined,
  Body: () => () => undefined,
  Res: () => () => undefined,
  HttpCode: () => () => undefined,
  Inject: () => () => undefined,
  SetMetadata: vi.fn().mockReturnValue(() => undefined),
}));

vi.mock('./session.guard.js', () => ({ SessionGuard: class {} }));
vi.mock('./current-user.decorator.js', () => ({
  CurrentUser: () => () => undefined,
}));

import { AuthController } from './auth.controller.js';
import { AUTH_COOKIE_NAME, XSRF_COOKIE_NAME } from './cookie.constants.js';
import { UserStatus } from 'shared-contracts';
import type { ApiConfig } from '../config/api-config.js';
import type {
  VerifyTelegramLoginService,
  LoginWithTelegramService,
  ITokenIssuer,
} from 'identity-application';
import type { Response } from 'express';

function makeRes(): {
  res: Response;
  cookie: ReturnType<typeof vi.fn>;
  clearCookie: ReturnType<typeof vi.fn>;
} {
  const cookie = vi.fn();
  const clearCookie = vi.fn();
  const res = { cookie, clearCookie } as unknown as Response;
  return { res, cookie, clearCookie };
}

function makeUser(status: string, roles: string[] = []) {
  return {
    id: 'user-1',
    telegramId: '123',
    firstName: 'Alice',
    username: 'alice',
    status,
    roles,
  };
}

describe('AuthController', () => {
  let verifyLogin: VerifyTelegramLoginService;
  let loginWithTelegram: LoginWithTelegramService;
  let tokenIssuer: ITokenIssuer;
  let config: ApiConfig;
  let controller: AuthController;

  beforeEach(() => {
    verifyLogin = {
      run: vi.fn().mockResolvedValue({ data: { id: 42, hash: 'abc' } }),
    } as unknown as VerifyTelegramLoginService;

    tokenIssuer = {
      issue: vi.fn().mockReturnValue('jwt-token'),
      verify: vi.fn(),
    } as unknown as ITokenIssuer;

    config = {
      botToken: 'bot-token',
      jwtSecret: 'secret',
      mongoUri: '',
      mongoDbName: '',
      port: 3000,
      mode: 'development',
    };

    loginWithTelegram = {
      run: vi.fn(),
    } as unknown as LoginWithTelegramService;
  });

  function makeController(): AuthController {
    return new AuthController(
      verifyLogin,
      loginWithTelegram,
      tokenIssuer,
      config,
    );
  }

  describe('POST /auth/telegram — active user', () => {
    it('sets httpOnly cookie and returns { status: "active" }', async () => {
      const user = makeUser(UserStatus.ACTIVE);
      (loginWithTelegram.run as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { user, status: UserStatus.ACTIVE },
      });

      controller = makeController();
      const { res, cookie } = makeRes();
      const result = await controller.telegramLogin({} as never, res);

      expect(result).toEqual({ status: 'active' });
      expect(cookie).toHaveBeenCalledTimes(2);
      const [name, , opts] = (cookie as ReturnType<typeof vi.fn>).mock
        .calls[0] as [string, string, Record<string, unknown>];
      expect(name).toBe(AUTH_COOKIE_NAME);
      expect(opts).toMatchObject({
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
      });
    });

    it('calls tokenIssuer.issue with correct payload for active user', async () => {
      const user = makeUser(UserStatus.ACTIVE);
      (loginWithTelegram.run as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { user, status: UserStatus.ACTIVE },
      });

      controller = makeController();
      const { res } = makeRes();
      await controller.telegramLogin({} as never, res);

      expect(tokenIssuer.issue).toHaveBeenCalledWith({
        sub: user.id,
        status: 'active',
        roles: [],
      });
    });

    it('issues a JWT whose roles claim carries the persisted Role.SUPERADMIN', async () => {
      const user = makeUser(UserStatus.ACTIVE, ['superadmin']);
      (loginWithTelegram.run as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { user, status: UserStatus.ACTIVE },
      });

      controller = makeController();
      const { res } = makeRes();
      await controller.telegramLogin({} as never, res);

      expect(tokenIssuer.issue).toHaveBeenCalledWith({
        sub: user.id,
        status: 'active',
        roles: ['superadmin'],
      });
    });

    it('sets secure: true on the cookie when mode is "production"', async () => {
      const user = makeUser(UserStatus.ACTIVE);
      (loginWithTelegram.run as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { user, status: UserStatus.ACTIVE },
      });

      config = { ...config, mode: 'production' };
      controller = makeController();
      const { res, cookie } = makeRes();
      await controller.telegramLogin({} as never, res);

      const [, , opts] = (cookie as ReturnType<typeof vi.fn>).mock.calls[0] as [
        string,
        string,
        Record<string, unknown>,
      ];
      expect(opts).toMatchObject({ secure: true });
    });
  });

  describe('POST /auth/telegram — pending user', () => {
    it('sets cookie and returns { status: "pending" } — JWT issued so user can call GET /auth/me', async () => {
      const user = makeUser(UserStatus.PENDING);
      (loginWithTelegram.run as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { user, status: UserStatus.PENDING },
      });

      controller = makeController();
      const { res, cookie } = makeRes();
      const result = await controller.telegramLogin({} as never, res);

      expect(result).toEqual({ status: 'pending' });
      expect(cookie).toHaveBeenCalledTimes(2);
    });
  });

  describe('POST /auth/telegram — rejected user', () => {
    it('sets cookie and returns { status: "rejected" } — JWT issued so user can check their status', async () => {
      const user = makeUser(UserStatus.REJECTED);
      (loginWithTelegram.run as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { user, status: UserStatus.REJECTED },
      });

      controller = makeController();
      const { res, cookie } = makeRes();
      const result = await controller.telegramLogin({} as never, res);

      expect(result).toEqual({ status: 'rejected' });
      expect(cookie).toHaveBeenCalledTimes(2);
    });
  });

  describe('POST /auth/logout', () => {
    it('clears both the auth cookie and the XSRF cookie with path "/"', () => {
      controller = makeController();
      const { res, clearCookie } = makeRes();
      controller.logout(res);

      expect(clearCookie).toHaveBeenCalledWith(AUTH_COOKIE_NAME, { path: '/' });
      expect(clearCookie).toHaveBeenCalledWith(XSRF_COOKIE_NAME, { path: '/' });
      expect(clearCookie).toHaveBeenCalledTimes(2);
    });
  });

  describe('GET /auth/me', () => {
    it('returns the session user as-is for an ACTIVE user', () => {
      controller = makeController();
      const user = {
        id: 'u1',
        telegramId: '123',
        displayName: 'Alice',
        status: UserStatus.ACTIVE,
      };
      expect(controller.getMe(user as never)).toEqual(user);
    });

    it('returns the session user as-is for a PENDING user — no status gate on this endpoint', () => {
      controller = makeController();
      const user = {
        id: 'u2',
        telegramId: '456',
        displayName: 'Bob',
        status: UserStatus.PENDING,
      };
      expect(controller.getMe(user as never)).toEqual(user);
    });
  });
});
