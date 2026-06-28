import { Module } from '@nestjs/common';
import type pino from 'pino';

import { createPinoLogger } from 'shared-infrastructure';
import { API_CONFIG } from '../config/api-config.js';
import type { ApiConfig } from '../config/api-config.js';
import { PINO_LOGGER } from './logger.tokens.js';

@Module({
  providers: [
    {
      provide: PINO_LOGGER,
      useFactory: (config: ApiConfig): pino.Logger =>
        createPinoLogger({ mode: config.mode }),
      inject: [API_CONFIG],
    },
  ],
  exports: [PINO_LOGGER],
})
export class LoggerModule {}
