import { Catch, Inject } from '@nestjs/common';
import type { ExceptionFilter, ArgumentsHost } from '@nestjs/common';
import type { Response } from 'express';
import type pino from 'pino';

import { BaseError } from 'shared-errors';

import { PINO_LOGGER } from '../logger/logger.tokens.js';

/**
 * Catches every `BaseError` thrown inside a request lifecycle, maps it to the
 * appropriate HTTP status code, and writes a sanitized response body.
 * No stack trace or internal error details are ever sent to the client.
 */
@Catch(BaseError)
export class BaseErrorFilter implements ExceptionFilter<BaseError> {
  constructor(@Inject(PINO_LOGGER) private readonly logger: pino.Logger) {}

  catch(exception: BaseError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const { code, message, statusCode } = exception.serialize();

    this.logger.warn({ statusCode }, `[${code}] ${message}`);

    response.status(statusCode).json({ code, message });
  }
}
