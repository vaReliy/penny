import { Module } from '@nestjs/common';

import { ConfigModule } from '../config/config.module.js';
import { IdentityModule } from '../identity/identity.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { HelloModule } from '../hello/hello.module.js';
import { HealthController } from '../health/health.controller.js';

@Module({
  imports: [ConfigModule, IdentityModule, AuthModule, HelloModule],
  controllers: [HealthController],
})
export class AppModule {}
