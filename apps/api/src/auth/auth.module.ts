import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';

import { IdentityModule } from '../identity/identity.module.js';
import { AuthController } from './auth.controller.js';
import { SessionGuard } from './session.guard.js';
import { ActiveUserGuard } from './active-user.guard.js';
import { CsrfGuard } from './csrf.guard.js';
import {
  TELEGRAM_LOGIN_THROTTLE_TTL_MS,
  TELEGRAM_LOGIN_THROTTLE_LIMIT,
} from './telegram-login-throttle.constants.js';

@Module({
  imports: [
    IdentityModule,
    ThrottlerModule.forRoot([
      {
        ttl: TELEGRAM_LOGIN_THROTTLE_TTL_MS,
        limit: TELEGRAM_LOGIN_THROTTLE_LIMIT,
      },
    ]),
  ],
  controllers: [AuthController],
  providers: [SessionGuard, ActiveUserGuard, CsrfGuard],
  exports: [SessionGuard, ActiveUserGuard, CsrfGuard, IdentityModule],
})
export class AuthModule {}
