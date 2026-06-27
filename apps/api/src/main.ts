import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import pinoHttp from 'pino-http';

import { createPinoLogger } from 'identity-infrastructure';
import { registerLivrRules } from 'shared-kernel';

import { AppModule } from './app/app.module.js';
import { BaseErrorFilter } from './filters/base-error.filter.js';
import { UnknownErrorFilter } from './filters/unknown-error.filter.js';
import { API_CONFIG } from './config/api-config.js';
import { PinoNestLogger } from './logger/pino-nest-logger.js';
import type { ApiConfig } from './config/api-config.js';

registerLivrRules();

async function bootstrap(): Promise<void> {
  const mode =
    process.env['NODE_ENV'] === 'production' ? 'production' : 'development';
  const pinoLogger = createPinoLogger({ mode });

  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Redirect all NestJS framework logs (lifecycle, filters) to the pino instance.
  // bufferLogs: true above ensures bootstrap logs are queued until this call,
  // at which point they are flushed through the pino-backed adapter.
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
