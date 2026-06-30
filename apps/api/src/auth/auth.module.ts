import { Module } from '@nestjs/common';

import { IdentityModule } from '../identity/identity.module.js';
import { AuthController } from './auth.controller.js';
import { SessionGuard } from './session.guard.js';
import { ActiveUserGuard } from './active-user.guard.js';
import { CsrfGuard } from './csrf.guard.js';

@Module({
  imports: [IdentityModule],
  controllers: [AuthController],
  providers: [SessionGuard, ActiveUserGuard, CsrfGuard],
  exports: [SessionGuard, ActiveUserGuard, CsrfGuard, IdentityModule],
})
export class AuthModule {}
