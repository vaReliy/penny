import { BaseError } from './base-error.js';
import { ErrorCode } from './error-codes.js';
import { HttpStatus } from './http-status.js';

/**
 * The kind of domain rule violation. Each kind maps to a distinct HTTP
 * status and error code — `DomainError` is the single class covering all
 * three, since they share the same "business rule rejected the operation"
 * shape and differ only in status/code.
 */
export const DomainErrorKind = {
  CONFLICT: 'CONFLICT',
  FORBIDDEN: 'FORBIDDEN',
  UNPROCESSABLE: 'UNPROCESSABLE',
} as const;

export type DomainErrorKind =
  (typeof DomainErrorKind)[keyof typeof DomainErrorKind];

/** Maps each `DomainErrorKind` to its HTTP status code. */
const STATUS_BY_KIND: Readonly<Record<DomainErrorKind, HttpStatus>> = {
  [DomainErrorKind.CONFLICT]: HttpStatus.CONFLICT,
  [DomainErrorKind.FORBIDDEN]: HttpStatus.FORBIDDEN,
  [DomainErrorKind.UNPROCESSABLE]: HttpStatus.UNPROCESSABLE_ENTITY,
};

/** Maps each `DomainErrorKind` to its stable error code. */
const CODE_BY_KIND: Readonly<Record<DomainErrorKind, ErrorCode>> = {
  [DomainErrorKind.CONFLICT]: ErrorCode.DOMAIN_CONFLICT_ERROR,
  [DomainErrorKind.FORBIDDEN]: ErrorCode.DOMAIN_FORBIDDEN_ERROR,
  [DomainErrorKind.UNPROCESSABLE]: ErrorCode.DOMAIN_UNPROCESSABLE_ERROR,
};

/** Default user-facing message when no specific message is supplied. */
const DEFAULT_MESSAGE = 'The operation violates a business rule.';

/**
 * Raised when a business rule rejects an operation. Covers HTTP 409
 * (conflict), 403 (forbidden), and 422 (unprocessable) via `kind`.
 */
export class DomainError extends BaseError {
  public readonly code: ErrorCode;
  public readonly statusCode: HttpStatus;
  public readonly kind: DomainErrorKind;

  public constructor(kind: DomainErrorKind, message: string = DEFAULT_MESSAGE) {
    super(message);
    this.kind = kind;
    this.code = CODE_BY_KIND[kind];
    this.statusCode = STATUS_BY_KIND[kind];
  }

  /** Raised when an operation conflicts with current state. Maps to HTTP 409. */
  public static conflict(message?: string): DomainError {
    return new DomainError(DomainErrorKind.CONFLICT, message);
  }

  /** Raised when an actor is not permitted to perform an operation. Maps to HTTP 403. */
  public static forbidden(message?: string): DomainError {
    return new DomainError(DomainErrorKind.FORBIDDEN, message);
  }

  /** Raised when input is well-formed but semantically invalid. Maps to HTTP 422. */
  public static unprocessable(message?: string): DomainError {
    return new DomainError(DomainErrorKind.UNPROCESSABLE, message);
  }
}
