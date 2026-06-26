import { Module } from '@nestjs/common';

import { ConfigModule } from '../config/config.module.js';
import { IdentityModule } from '../identity/identity.module.js';
import { HealthController } from '../health/health.controller.js';

@Module({
  imports: [ConfigModule, IdentityModule],
  controllers: [HealthController],
})
export class AppModule {}
