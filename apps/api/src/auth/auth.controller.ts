import { Controller, Post, Body, Inject, Res, HttpCode } from '@nestjs/common';
import type { Response } from 'express';

import type {
  VerifyTelegramLoginService,
  LoginWithTelegramService,
  ITokenIssuer,
  RawTelegramLoginPayload,
} from 'identity-application';
import { UserStatus } from 'identity-core';

import { TOKENS } from '../identity/tokens.js';
import { API_CONFIG } from '../config/api-config.js';
import type { ApiConfig } from '../config/api-config.js';
import {
  AUTH_COOKIE_NAME,
  AUTH_COOKIE_MAX_AGE_MS,
} from './cookie.constants.js';

interface TelegramLoginResponse {
  readonly status: string;
}

@Controller('auth')
export class AuthController {
  public constructor(
    @Inject(TOKENS.VerifyTelegramLogin)
    private readonly verifyLogin: VerifyTelegramLoginService,
    @Inject(TOKENS.LoginWithTelegram)
    private readonly loginWithTelegram: LoginWithTelegramService,
    @Inject(TOKENS.TokenIssuer)
    private readonly tokenIssuer: ITokenIssuer,
    @Inject(API_CONFIG)
    private readonly config: ApiConfig,
  ) {}

  // TODO: apply rate limiting (e.g. @nestjs/throttler ~5 req/min/IP) to prevent
  // resource exhaustion and amplified DB load on repeated Telegram login attempts.
  @Post('telegram')
  @HttpCode(200)
  public async telegramLogin(
    @Body() body: RawTelegramLoginPayload,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TelegramLoginResponse> {
    const { data: verified } = await this.verifyLogin.run(body, {
      config: { telegramBotToken: this.config.botToken },
      caller: null,
    });

    const {
      data: { user, status },
    } = await this.loginWithTelegram.run(verified, {
      config: {},
      caller: null,
    });

    if (status === UserStatus.ACTIVE) {
      const token = this.tokenIssuer.issue({
        sub: user.id,
        status: user.status,
        roles: [],
      });
      res.cookie(AUTH_COOKIE_NAME, token, {
        httpOnly: true,
        secure: this.config.mode === 'production',
        sameSite: 'lax',
        maxAge: AUTH_COOKIE_MAX_AGE_MS,
        path: '/',
      });
    }

    return { status };
  }

  @Post('logout')
  @HttpCode(204)
  public logout(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(AUTH_COOKIE_NAME, { path: '/' });
  }
}
