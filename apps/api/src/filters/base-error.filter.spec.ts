import { beforeEach, describe, expect, it, vi } from 'vitest';
import type pino from 'pino';

/**
 * Mock @nestjs/common before importing the filter so that the `@Catch` and
 * `@Inject` decorators do not require NestJS's DI bootstrap or
 * `reflect-metadata` in the test process.
 */
vi.mock('@nestjs/common', () => ({
  Catch: () => () => undefined,
  Inject: () => () => undefined,
}));

import type { ArgumentsHost } from '@nestjs/common';
import {
  AuthenticationError,
  DomainError,
  InfrastructureError,
  NotFoundError,
  ValidationError,
} from 'shared-errors';

import { BaseErrorFilter } from './base-error.filter.js';

/** Builds a minimal `ArgumentsHost` stub that captures `status` and `json` calls. */
function makeHost(): {
  host: ArgumentsHost;
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
} {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const getResponse = vi.fn().mockReturnValue({ status });
  const switchToHttp = vi.fn().mockReturnValue({ getResponse });
  return {
    host: { switchToHttp } as unknown as ArgumentsHost,
    status,
    json,
  };
}

describe('BaseErrorFilter', () => {
  let filter: BaseErrorFilter;
  let mockLogger: {
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockLogger = { warn: vi.fn(), error: vi.fn() };
    filter = new BaseErrorFilter(mockLogger as unknown as pino.Logger);
  });

  it('maps ValidationError to HTTP 400', () => {
    const { host, status } = makeHost();
    filter.catch(new ValidationError('Email is required.'), host);
    expect(status).toHaveBeenCalledWith(400);
  });

  it('maps AuthenticationError to HTTP 401', () => {
    const { host, status } = makeHost();
    filter.catch(new AuthenticationError(), host);
    expect(status).toHaveBeenCalledWith(401);
  });

  it('maps NotFoundError to HTTP 404', () => {
    const { host, status } = makeHost();
    filter.catch(new NotFoundError(), host);
    expect(status).toHaveBeenCalledWith(404);
  });

  it('maps DomainError.conflict() to HTTP 409', () => {
    const { host, status } = makeHost();
    filter.catch(DomainError.conflict('Already exists.'), host);
    expect(status).toHaveBeenCalledWith(409);
  });

  it('maps DomainError.forbidden() to HTTP 403', () => {
    const { host, status } = makeHost();
    filter.catch(DomainError.forbidden('Access denied.'), host);
    expect(status).toHaveBeenCalledWith(403);
  });

  it('maps DomainError.unprocessable() to HTTP 422', () => {
    const { host, status } = makeHost();
    filter.catch(DomainError.unprocessable('Invalid state.'), host);
    expect(status).toHaveBeenCalledWith(422);
  });

  it('maps InfrastructureError to HTTP 500', () => {
    const { host, status } = makeHost();
    filter.catch(new InfrastructureError(), host);
    expect(status).toHaveBeenCalledWith(500);
  });

  it('sends only { code, message } — no stack or internal properties', () => {
    const { host, json } = makeHost();
    filter.catch(new ValidationError('Bad input.'), host);

    expect(json).toHaveBeenCalledOnce();
    const body: unknown = json.mock.calls[0][0];
    expect(body).toEqual({ code: 'VALIDATION_ERROR', message: 'Bad input.' });
    expect(body).not.toHaveProperty('stack');
    expect(body).not.toHaveProperty('statusCode');
    expect(body).not.toHaveProperty('name');
    expect(Object.keys(body as object).sort()).toEqual(['code', 'message']);
  });

  it('sends the correct code for each error type', () => {
    const cases: Array<[import('shared-errors').BaseError, string, number]> = [
      [new ValidationError(), 'VALIDATION_ERROR', 400],
      [new AuthenticationError(), 'AUTHENTICATION_ERROR', 401],
      [new NotFoundError(), 'NOT_FOUND_ERROR', 404],
      [DomainError.conflict(), 'DOMAIN_CONFLICT_ERROR', 409],
      [DomainError.forbidden(), 'DOMAIN_FORBIDDEN_ERROR', 403],
      [DomainError.unprocessable(), 'DOMAIN_UNPROCESSABLE_ERROR', 422],
      [new InfrastructureError(), 'INFRASTRUCTURE_ERROR', 500],
    ];

    for (const [error, expectedCode, expectedStatus] of cases) {
      const { host, status, json } = makeHost();
      filter.catch(error, host);
      expect(status).toHaveBeenCalledWith(expectedStatus);
      expect((json.mock.calls[0][0] as { code: string }).code).toBe(
        expectedCode,
      );
    }
  });

  it('includes the original error message in the response body', () => {
    const { host, json } = makeHost();
    filter.catch(new NotFoundError('User not found.'), host);
    expect((json.mock.calls[0][0] as { message: string }).message).toBe(
      'User not found.',
    );
  });

  it('calls logger.warn with { statusCode } and the interpolated [code] message string', () => {
    const { host } = makeHost();
    filter.catch(new ValidationError('Email is required.'), host);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      { statusCode: 400 },
      '[VALIDATION_ERROR] Email is required.',
    );
  });
});
