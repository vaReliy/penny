import { Catch, Inject } from '@nestjs/common';
import type { ExceptionFilter, ArgumentsHost } from '@nestjs/common';
import type { Response } from 'express';
import type pino from 'pino';

import { BaseError } from 'shared-errors';

import { PINO_LOGGER } from '../logger/logger.tokens.js';

/** HTTP 500 status code returned for unexpected errors. */
const INTERNAL_ERROR_STATUS = 500;

/**
 * Catch-all filter for any error that is NOT a `BaseError`.
 * Returns a generic 500 response without leaking internal details.
 * The `instanceof BaseError` guard below is a defensive check: NestJS routes
 * `BaseError` instances to the more-specific `BaseErrorFilter` first, but the
 * guard prevents a double-response if both filters ever fire on the same error.
 */
@Catch()
export class UnknownErrorFilter implements ExceptionFilter<unknown> {
  constructor(@Inject(PINO_LOGGER) private readonly logger: pino.Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    if (exception instanceof BaseError) {
      return;
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const message =
      exception instanceof Error ? exception.message : 'Unexpected error';

    this.logger.error({ message }, 'Unhandled exception');

    response.status(INTERNAL_ERROR_STATUS).json({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    });
  }
}
