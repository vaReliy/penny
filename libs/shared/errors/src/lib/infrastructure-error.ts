import { BaseError } from './base-error.js';
import { ErrorCode } from './error-codes.js';
import { HttpStatus } from './http-status.js';

/**
 * Default user-facing message when no specific message is supplied.
 * Deliberately generic — infrastructure failures must never leak internal
 * details (DB connection strings, stack traces, etc.) to the client.
 */
const DEFAULT_MESSAGE = 'An unexpected error occurred. Please try again later.';

/** Raised on infrastructure/transport failures (DB, network, etc.). Maps to HTTP 500. */
export class InfrastructureError extends BaseError {
  public readonly code = ErrorCode.INFRASTRUCTURE_ERROR;
  public readonly statusCode = HttpStatus.INTERNAL_SERVER_ERROR;

  public constructor() {
    super(DEFAULT_MESSAGE);
  }
}
