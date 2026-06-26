import { Module } from '@nestjs/common';

import { IdentityModule } from '../identity/identity.module.js';
import { AuthController } from './auth.controller.js';
import { SessionGuard } from './session.guard.js';

@Module({
  imports: [IdentityModule],
  controllers: [AuthController],
  providers: [SessionGuard],
  exports: [SessionGuard],
})
export class AuthModule {}
