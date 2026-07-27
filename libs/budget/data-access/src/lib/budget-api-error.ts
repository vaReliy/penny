import type { HttpErrorResponse } from '@angular/common/http';

/**
 * UI-facing classification of a budget API failure. Mirrors `shared-errors`'
 * `ErrorCode` groupings without importing that lib — `type:data` libs may not
 * depend on `type:errors` (see `eslint.config.mjs` depConstraints), so the
 * mapping below is a deliberate, independent restatement of the same wire
 * contract (`{ code, message, statusCode }` for `BaseError`, Nest's default
 * `{ statusCode, message, error }` for guard-thrown `HttpException`s).
 */
export const BudgetApiErrorKind = {
  VALIDATION: 'VALIDATION',
  AUTHENTICATION: 'AUTHENTICATION',
  NOT_FOUND: 'NOT_FOUND',
  DOMAIN: 'DOMAIN',
  UNKNOWN: 'UNKNOWN',
} as const;

export type BudgetApiErrorKind =
  (typeof BudgetApiErrorKind)[keyof typeof BudgetApiErrorKind];

export interface BudgetApiError {
  readonly kind: BudgetApiErrorKind;
  readonly message: string;
}

/** Default message shown when the response body carries nothing usable. */
const DEFAULT_MESSAGE = 'Something went wrong. Please try again.';

/** Codes emitted by `shared-errors`' `BaseError` hierarchy, restated as literals. */
const CODE_TO_KIND: Readonly<Record<string, BudgetApiErrorKind>> = {
  VALIDATION_ERROR: BudgetApiErrorKind.VALIDATION,
  AUTHENTICATION_ERROR: BudgetApiErrorKind.AUTHENTICATION,
  NOT_FOUND_ERROR: BudgetApiErrorKind.NOT_FOUND,
  DOMAIN_CONFLICT_ERROR: BudgetApiErrorKind.DOMAIN,
  DOMAIN_FORBIDDEN_ERROR: BudgetApiErrorKind.DOMAIN,
  DOMAIN_UNPROCESSABLE_ERROR: BudgetApiErrorKind.DOMAIN,
};

interface SerializedBaseErrorBody {
  readonly code: string;
  readonly message: string;
}

function isSerializedBaseErrorBody(
  body: unknown,
): body is SerializedBaseErrorBody {
  return (
    typeof body === 'object' &&
    body !== null &&
    typeof (body as { code?: unknown }).code === 'string' &&
    typeof (body as { message?: unknown }).message === 'string'
  );
}

/**
 * Maps any `HttpErrorResponse` from a budget API call to the typed UI error
 * model. Handles the sanitized `BaseError` shape first (covers validation,
 * auth, not-found, and domain errors), then falls back to HTTP status for
 * guard-thrown `HttpException`s (e.g. `ActiveUserGuard`'s bare 403) and
 * network/unknown failures.
 */
export function toBudgetApiError(error: HttpErrorResponse): BudgetApiError {
  const body: unknown = error.error;

  if (isSerializedBaseErrorBody(body)) {
    return {
      kind: CODE_TO_KIND[body.code] ?? BudgetApiErrorKind.UNKNOWN,
      message: body.message,
    };
  }

  if (error.status === 401) {
    return {
      kind: BudgetApiErrorKind.AUTHENTICATION,
      message: DEFAULT_MESSAGE,
    };
  }

  if (error.status === 404) {
    return { kind: BudgetApiErrorKind.NOT_FOUND, message: DEFAULT_MESSAGE };
  }

  return { kind: BudgetApiErrorKind.UNKNOWN, message: DEFAULT_MESSAGE };
}
