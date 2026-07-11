import { randomBytes } from 'node:crypto';

import {
  Controller,
  Post,
  Get,
  Body,
  Inject,
  Res,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';

import type {
  VerifyTelegramLoginService,
  LoginWithTelegramService,
  ITokenIssuer,
} from 'identity-application';
import type { SessionUser, RawTelegramLoginPayload } from 'shared-contracts';

import { TOKENS } from '../identity/tokens.js';
import { API_CONFIG } from '../config/api-config.js';
import type { ApiConfig } from '../config/api-config.js';
import {
  AUTH_COOKIE_NAME,
  AUTH_COOKIE_MAX_AGE_MS,
  XSRF_COOKIE_NAME,
} from './cookie.constants.js';
import { SkipCsrf } from './skip-csrf.decorator.js';
import { SessionGuard } from './session.guard.js';
import { CurrentUser } from './current-user.decorator.js';

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

  @Get('me')
  @UseGuards(SessionGuard)
  public getMe(@CurrentUser() user: SessionUser): SessionUser {
    return user;
  }

  @Post('telegram')
  @HttpCode(200)
  @SkipCsrf()
  @UseGuards(ThrottlerGuard)
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

    const token = this.tokenIssuer.issue({
      sub: user.id,
      status: user.status,
      roles: user.roles,
    });
    res.cookie(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: this.config.mode === 'production',
      sameSite: 'lax',
      maxAge: AUTH_COOKIE_MAX_AGE_MS,
      path: '/',
    });
    const csrfToken = randomBytes(32).toString('hex');
    res.cookie(XSRF_COOKIE_NAME, csrfToken, {
      httpOnly: false,
      secure: this.config.mode === 'production',
      sameSite: 'lax',
      maxAge: AUTH_COOKIE_MAX_AGE_MS,
      path: '/',
    });

    return { status };
  }

  @Post('logout')
  @HttpCode(204)
  public logout(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(AUTH_COOKIE_NAME, { path: '/' });
    res.clearCookie(XSRF_COOKIE_NAME, { path: '/' });
  }
}
