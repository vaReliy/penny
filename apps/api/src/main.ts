import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import mongoSanitize from 'express-mongo-sanitize';
import pinoHttp from 'pino-http';
import type pino from 'pino';

import { registerLivrRules } from 'shared-kernel';

import { AppModule } from './app/app.module.js';
import { API_CONFIG } from './config/api-config.js';
import { cspMiddleware } from './middleware/csp-policy.js';
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

  // Per-request CSP nonce middleware: generates a cryptographic nonce, stores
  // it in res.locals['nonce'], then applies Helmet with style-src restricted
  // to that nonce (no unsafe-inline).
  app.use(cspMiddleware);

  // Strip $-prefixed and dot-prefixed keys from req.body/params/query to prevent
  // NoSQL operator injection reaching any route handler.
  app.use(mongoSanitize());

  app.enableShutdownHooks();

  const config = app.get<ApiConfig>(API_CONFIG);

  if (config.mode !== 'production') {
    pinoLogger.warn(
      'NODE_ENV is not "production" — cookie Secure flag is disabled and debug logging is active. ' +
        'Set NODE_ENV=production in production deployments.',
    );
  }

  await app.listen(config.port);
}

bootstrap().catch((err: unknown) => {
  console.error('Fatal bootstrap error', err);
  process.exit(1);
});
