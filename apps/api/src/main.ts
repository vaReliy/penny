import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import pinoHttp from 'pino-http';
import type pino from 'pino';

import { registerLivrRules } from 'shared-kernel';

import { AppModule } from './app/app.module.js';
import { BaseErrorFilter } from './filters/base-error.filter.js';
import { UnknownErrorFilter } from './filters/unknown-error.filter.js';
import { API_CONFIG } from './config/api-config.js';
import { PinoNestLogger } from './logger/pino-nest-logger.js';
import { PINO_LOGGER } from './logger/logger.tokens.js';
import type { ApiConfig } from './config/api-config.js';

registerLivrRules();

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Retrieve the single shared pino logger from DI.
  // bufferLogs: true above held bootstrap logs until this point.
  const pinoLogger = app.get<pino.Logger>(PINO_LOGGER);

  // Redirect all NestJS framework logs (lifecycle, filters) to the pino instance.
  app.useLogger(new PinoNestLogger(pinoLogger));

  app.setGlobalPrefix('api');

  // Share the same root pino instance with pino-http so HTTP request logs and
  // framework logs land in a single stream with a consistent format.
  app.use(pinoHttp({ logger: pinoLogger }));

  app.useGlobalFilters(new BaseErrorFilter(), new UnknownErrorFilter());
  app.enableShutdownHooks();

  const config = app.get<ApiConfig>(API_CONFIG);
  await app.listen(config.port);
}

bootstrap().catch((err: unknown) => {
  console.error('Fatal bootstrap error', err);
  process.exit(1);
});
