import { Module } from '@nestjs/common';
import type pino from 'pino';

import { createPinoLogger } from 'identity-infrastructure';
import { API_CONFIG } from '../config/cli-config.js';
import type { CliConfig } from '../config/cli-config.js';
import { PINO_LOGGER } from './logger.tokens.js';

@Module({
  providers: [
    {
      provide: PINO_LOGGER,
      useFactory: (config: CliConfig): pino.Logger =>
        createPinoLogger({ mode: config.mode }),
      inject: [API_CONFIG],
    },
  ],
  exports: [PINO_LOGGER],
})
export class LoggerModule {}
