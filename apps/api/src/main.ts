import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import pinoHttp from 'pino-http';
import type pino from 'pino';
import type { Request, Response, NextFunction } from 'express';

import { registerLivrRules } from 'shared-kernel';

import { AppModule } from './app/app.module.js';
import { API_CONFIG } from './config/api-config.js';
import { CSP_DIRECTIVES } from './middleware/csp-policy.js';
import { PinoNestLogger } from './logger/pino-nest-logger.js';
import { PINO_LOGGER } from './logger/logger.tokens.js';
import type { ApiConfig } from './config/api-config.js';

registerLivrRules();

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // bufferLogs: true above held bootstrap logs until this point.
  const pinoLogger = app.get<pino.Logger>(PINO_LOGGER);

  app.useLogger(new PinoNestLogger(pinoLogger));

  app.setGlobalPrefix('api');

  app.use(pinoHttp({ logger: pinoLogger }));

  // CSP restricts sources to permit the Telegram Login Widget (script-src, frame-src,
  // img-src) while blocking all other external origins. HTTP header delivery is
  // XSS-resistant unlike <meta> tags.
  app.use(helmet({ contentSecurityPolicy: { directives: CSP_DIRECTIVES } }));

  // Applied only to body because Express 5 made req.query a getter-only property —
  // the express-mongo-sanitize middleware tries to reassign it and throws.
  // Query-param injection is low-risk: LIVR validation rejects unexpected shapes before
  // any domain logic runs, and mongoose query builders don't accept raw operator objects.
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (req.body !== null && req.body !== undefined) {
      // Strip $-prefixed and dot-prefixed keys from req.body to prevent NoSQL operator injection.
      req.body = mongoSanitize.sanitize(req.body);
    }
    next();
  });

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
