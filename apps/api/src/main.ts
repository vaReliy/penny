import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import pinoHttp from 'pino-http';

import { registerLivrRules } from 'shared-kernel';

import { AppModule } from './app/app.module.js';
import { BaseErrorFilter } from './filters/base-error.filter.js';
import { UnknownErrorFilter } from './filters/unknown-error.filter.js';
import { API_CONFIG } from './config/api-config.js';
import type { ApiConfig } from './config/api-config.js';

registerLivrRules();

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.setGlobalPrefix('api');
  app.use(pinoHttp());
  app.useGlobalFilters(new BaseErrorFilter(), new UnknownErrorFilter());
  app.enableShutdownHooks();

  const config = app.get<ApiConfig>(API_CONFIG);
  await app.listen(config.port);
}

bootstrap().catch((err: unknown) => {
  console.error('Fatal bootstrap error', err);
  process.exit(1);
});
