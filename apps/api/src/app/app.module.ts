import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { ConfigModule } from '../config/config.module.js';
import { LoggerModule } from '../logger/logger.module.js';
import { IdentityModule } from '../identity/identity.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { HelloModule } from '../hello/hello.module.js';
import { HealthController } from '../health/health.controller.js';
import { CsrfGuard } from '../auth/csrf.guard.js';

@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    IdentityModule,
    AuthModule,
    HelloModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: CsrfGuard }],
})
export class AppModule {}
