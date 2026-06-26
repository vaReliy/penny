import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@nestjs/common', () => ({
  Controller: () => () => undefined,
  Post: () => () => undefined,
  Body: () => () => undefined,
  Res: () => () => undefined,
  HttpCode: () => () => undefined,
  Inject: () => () => undefined,
}));

import { AuthController } from './auth.controller.js';
import { AUTH_COOKIE_NAME } from './cookie.constants.js';
import { UserStatus } from 'identity-core';
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

function makeUser(status: string) {
  return {
    id: 'user-1',
    telegramId: '123',
    firstName: 'Alice',
    username: 'alice',
    status,
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
      expect(cookie).toHaveBeenCalledOnce();
      const [name, , opts] = (cookie as ReturnType<typeof vi.fn>).mock
        .calls[0] as [string, string, Record<string, unknown>];
      expect(name).toBe(AUTH_COOKIE_NAME);
      expect(opts).toMatchObject({
        httpOnly: true,
        secure: true,
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
  });

  describe('POST /auth/telegram — pending user', () => {
    it('does not set cookie and returns { status: "pending" }', async () => {
      const user = makeUser(UserStatus.PENDING);
      (loginWithTelegram.run as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { user, status: UserStatus.PENDING },
      });

      controller = makeController();
      const { res, cookie } = makeRes();
      const result = await controller.telegramLogin({} as never, res);

      expect(result).toEqual({ status: 'pending' });
      expect(cookie).not.toHaveBeenCalled();
    });
  });

  describe('POST /auth/telegram — rejected user', () => {
    it('does not set cookie and returns { status: "rejected" }', async () => {
      const user = makeUser(UserStatus.REJECTED);
      (loginWithTelegram.run as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { user, status: UserStatus.REJECTED },
      });

      controller = makeController();
      const { res, cookie } = makeRes();
      const result = await controller.telegramLogin({} as never, res);

      expect(result).toEqual({ status: 'rejected' });
      expect(cookie).not.toHaveBeenCalled();
    });
  });

  describe('POST /auth/logout', () => {
    it('calls res.clearCookie with token and path "/"', () => {
      controller = makeController();
      const { res, clearCookie } = makeRes();
      controller.logout(res);

      expect(clearCookie).toHaveBeenCalledWith(AUTH_COOKIE_NAME, { path: '/' });
    });
  });
});
