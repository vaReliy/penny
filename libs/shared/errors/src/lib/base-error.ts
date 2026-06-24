import type { ErrorCode } from './error-codes.js';
import type { HttpStatus } from './http-status.js';
import type { SerializedError } from './serialized-error.js';

/**
 * Root of the platform error hierarchy.
 *
 * Every `BaseError` carries a stable `code` and an HTTP `statusCode`, plus a
 * `message` that is always safe to show to an end user. `toJSON`/`serialize`
 * only ever expose `code`, `message`, and `statusCode` — never the stack
 * trace or any internal cause, so it is safe to send directly over the wire.
 */
export abstract class BaseError extends Error {
  public abstract readonly code: ErrorCode;
  public abstract readonly statusCode: HttpStatus;

  protected constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }

  /** Sanitized shape safe to serialize to JSON and send to a client. */
  public serialize(): SerializedError {
    return {
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
    };
  }

  /** Allows `JSON.stringify(error)` to produce the sanitized shape automatically. */
  public toJSON(): SerializedError {
    return this.serialize();
  }
}
