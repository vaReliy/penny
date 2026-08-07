import { HttpErrorResponse } from '@angular/common/http';
import { describe, it, expect } from 'vitest';
import {
  BudgetApiErrorKind,
  errorMessageKey,
  toBudgetApiError,
} from './budget-api-error.js';

function makeError(status: number, error: unknown): HttpErrorResponse {
  return new HttpErrorResponse({ status, error });
}

describe('toBudgetApiError', () => {
  it('maps a serialized ValidationError body to VALIDATION', () => {
    const result = toBudgetApiError(
      makeError(400, {
        code: 'VALIDATION_ERROR',
        message: 'The request payload is invalid.',
        statusCode: 400,
      }),
    );

    expect(result).toEqual({
      kind: BudgetApiErrorKind.VALIDATION,
      message: 'The request payload is invalid.',
    });
  });

  it('maps a serialized AuthenticationError body to AUTHENTICATION', () => {
    const result = toBudgetApiError(
      makeError(401, {
        code: 'AUTHENTICATION_ERROR',
        message: 'Authentication is required or has failed.',
        statusCode: 401,
      }),
    );

    expect(result.kind).toBe(BudgetApiErrorKind.AUTHENTICATION);
  });

  it('maps a serialized NotFoundError body to NOT_FOUND', () => {
    const result = toBudgetApiError(
      makeError(404, {
        code: 'NOT_FOUND_ERROR',
        message: 'The requested resource was not found.',
        statusCode: 404,
      }),
    );

    expect(result.kind).toBe(BudgetApiErrorKind.NOT_FOUND);
  });

  it('maps every DomainError kind code to DOMAIN', () => {
    for (const code of [
      'DOMAIN_CONFLICT_ERROR',
      'DOMAIN_FORBIDDEN_ERROR',
      'DOMAIN_UNPROCESSABLE_ERROR',
    ]) {
      const result = toBudgetApiError(
        makeError(409, {
          code,
          message: 'Business rule violated.',
          statusCode: 409,
        }),
      );
      expect(result.kind).toBe(BudgetApiErrorKind.DOMAIN);
    }
  });

  it('falls back to AUTHENTICATION on a bare 401 with no BaseError body (opaque guard rejection)', () => {
    const result = toBudgetApiError(makeError(401, null));
    expect(result.kind).toBe(BudgetApiErrorKind.AUTHENTICATION);
  });

  it('falls back to NOT_FOUND on a bare 404 with a Nest HttpException body', () => {
    const result = toBudgetApiError(
      makeError(404, {
        statusCode: 404,
        message: 'Not Found',
        error: 'Not Found',
      }),
    );
    expect(result.kind).toBe(BudgetApiErrorKind.NOT_FOUND);
  });

  it('falls back to UNKNOWN for a bare 403 (ActiveUserGuard ForbiddenException has no code field)', () => {
    const result = toBudgetApiError(
      makeError(403, {
        statusCode: 403,
        message: 'Forbidden',
        error: 'Forbidden',
      }),
    );
    expect(result.kind).toBe(BudgetApiErrorKind.UNKNOWN);
  });

  it('falls back to UNKNOWN for a network error with no response body', () => {
    const result = toBudgetApiError(makeError(0, null));
    expect(result.kind).toBe(BudgetApiErrorKind.UNKNOWN);
  });

  it('falls back to UNKNOWN for an unrecognized code', () => {
    const result = toBudgetApiError(
      makeError(500, {
        code: 'SOMETHING_NEW',
        message: 'oops',
        statusCode: 500,
      }),
    );
    expect(result.kind).toBe(BudgetApiErrorKind.UNKNOWN);
  });
});

describe('errorMessageKey', () => {
  it('maps every kind to a distinct, non-empty translation key', () => {
    const kinds = Object.values(BudgetApiErrorKind);
    const keys = kinds.map(errorMessageKey);

    for (const key of keys) {
      expect(key.length).toBeGreaterThan(0);
    }
    expect(new Set(keys).size).toBe(kinds.length);
  });
});
