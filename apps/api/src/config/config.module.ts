import { Global, Module } from '@nestjs/common';

import { API_CONFIG, loadApiConfig } from './api-config.js';
import { ConfigController } from './config.controller.js';

@Global()
@Module({
  controllers: [ConfigController],
  providers: [{ provide: API_CONFIG, useFactory: loadApiConfig }],
  exports: [API_CONFIG],
})
export class ConfigModule {}
