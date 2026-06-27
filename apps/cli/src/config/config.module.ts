import { Global, Module } from '@nestjs/common';

import { API_CONFIG, loadCliConfig } from './cli-config.js';

@Global()
@Module({
  providers: [{ provide: API_CONFIG, useFactory: loadCliConfig }],
  exports: [API_CONFIG],
})
export class ConfigModule {}
