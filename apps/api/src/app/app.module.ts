import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';

import { ConfigModule } from '../config/config.module.js';
import { LoggerModule } from '../logger/logger.module.js';
import { IdentityModule } from '../identity/identity.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { HelloModule } from '../hello/hello.module.js';
import { HealthController } from '../health/health.controller.js';
import { CsrfGuard } from '../auth/csrf.guard.js';
import { BaseErrorFilter } from '../filters/base-error.filter.js';
import { UnknownErrorFilter } from '../filters/unknown-error.filter.js';

@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    IdentityModule,
    AuthModule,
    HelloModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_FILTER, useClass: BaseErrorFilter },
    { provide: APP_FILTER, useClass: UnknownErrorFilter },
  ],
})
export class AppModule {}
