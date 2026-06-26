import { Catch, Logger } from '@nestjs/common';
import type { ExceptionFilter, ArgumentsHost } from '@nestjs/common';
import type { Response } from 'express';

import { BaseError } from 'shared-errors';

/**
 * Catches every `BaseError` thrown inside a request lifecycle, maps it to the
 * appropriate HTTP status code, and writes a sanitized response body.
 * No stack trace or internal error details are ever sent to the client.
 */
@Catch(BaseError)
export class BaseErrorFilter implements ExceptionFilter<BaseError> {
  private readonly logger = new Logger(BaseErrorFilter.name);

  catch(exception: BaseError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const { code, message, statusCode } = exception.serialize();

    this.logger.warn(`[${code}] ${message}`, { statusCode });

    response.status(statusCode).json({ code, message });
  }
}
