import { BaseError } from './base-error.js';
import { ErrorCode } from './error-codes.js';
import { HttpStatus } from './http-status.js';

/** Default user-facing message when no specific message is supplied. */
const DEFAULT_MESSAGE = 'The requested resource was not found.';

/** Raised when a requested resource does not exist. Maps to HTTP 404. */
export class NotFoundError extends BaseError {
  public readonly code = ErrorCode.NOT_FOUND_ERROR;
  public readonly statusCode = HttpStatus.NOT_FOUND;

  public constructor(message: string = DEFAULT_MESSAGE) {
    super(message);
  }
}
