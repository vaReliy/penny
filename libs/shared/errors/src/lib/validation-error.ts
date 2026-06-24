import { BaseError } from './base-error.js';
import { ErrorCode } from './error-codes.js';
import { HttpStatus } from './http-status.js';

/** Default user-facing message when no specific message is supplied. */
const DEFAULT_MESSAGE = 'The request payload is invalid.';

/** Raised when request input fails validation. Maps to HTTP 400. */
export class ValidationError extends BaseError {
  public readonly code = ErrorCode.VALIDATION_ERROR;
  public readonly statusCode = HttpStatus.BAD_REQUEST;

  public constructor(message: string = DEFAULT_MESSAGE) {
    super(message);
  }
}
