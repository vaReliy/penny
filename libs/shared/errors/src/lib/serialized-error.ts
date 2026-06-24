import type { ErrorCode } from './error-codes.js';
import type { HttpStatus } from './http-status.js';

/**
 * The sanitized, transport-safe shape of any `BaseError`.
 * Must never contain stack traces, internal messages, or implementation details.
 */
export interface SerializedError {
  readonly code: ErrorCode;
  readonly message: string;
  readonly statusCode: HttpStatus;
}
