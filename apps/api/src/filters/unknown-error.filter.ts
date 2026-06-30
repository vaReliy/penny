import { Catch, HttpException, Inject } from '@nestjs/common';
import type { ExceptionFilter, ArgumentsHost } from '@nestjs/common';
import type { Response } from 'express';
import type pino from 'pino';

import { PINO_LOGGER } from '../logger/logger.tokens.js';

/** HTTP 500 status code returned for unexpected errors. */
const INTERNAL_ERROR_STATUS = 500;

/**
 * Catch-all filter for HttpException instances (404/403 from NestJS guards)
 * and unknown JS errors. Never receives BaseError instances — BaseErrorFilter
 * carries @Catch(BaseError) and always wins on specificity.
 * The headersSent check is a defensive guard against double-writes if upstream
 * middleware has already committed the response.
 */
@Catch()
export class UnknownErrorFilter implements ExceptionFilter<unknown> {
  constructor(@Inject(PINO_LOGGER) private readonly logger: pino.Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (response.headersSent) {
      return;
    }

    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    const message =
      exception instanceof Error ? exception.message : 'Unexpected error';

    this.logger.error({ message }, 'Unhandled exception');

    response.status(INTERNAL_ERROR_STATUS).json({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    });
  }
}
