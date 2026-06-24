import { BaseError } from './base-error.js';
import { ErrorCode } from './error-codes.js';
import { HttpStatus } from './http-status.js';

/** Default user-facing message when no specific message is supplied. */
const DEFAULT_MESSAGE = 'Authentication is required or has failed.';

/** Raised when a request lacks valid credentials. Maps to HTTP 401. */
export class AuthenticationError extends BaseError {
  public readonly code = ErrorCode.AUTHENTICATION_ERROR;
  public readonly statusCode = HttpStatus.UNAUTHORIZED;

  public constructor(message: string = DEFAULT_MESSAGE) {
    super(message);
  }
}
