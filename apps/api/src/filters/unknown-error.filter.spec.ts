import { beforeEach, describe, expect, it, vi } from 'vitest';
import type pino from 'pino';

// HttpException must be a real class so `instanceof HttpException` inside the filter works.
const MockHttpException = vi.hoisted(() => {
  class HttpException extends Error {
    constructor(
      private readonly response: object | string,
      private readonly status: number,
    ) {
      super();
    }
    getStatus(): number {
      return this.status;
    }
    getResponse(): object | string {
      return this.response;
    }
  }
  return HttpException;
});

vi.mock('@nestjs/common', () => ({
  Catch: () => () => undefined,
  Inject: () => () => undefined,
  HttpException: MockHttpException,
}));

import { HttpException } from '@nestjs/common'; // resolves to MockHttpException
import type { ArgumentsHost } from '@nestjs/common';

import { UnknownErrorFilter } from './unknown-error.filter.js';

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

describe('UnknownErrorFilter', () => {
  let filter: UnknownErrorFilter;
  let mockLogger: {
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockLogger = { warn: vi.fn(), error: vi.fn() };
    filter = new UnknownErrorFilter(mockLogger as unknown as pino.Logger);
  });

  it('returns HTTP 500 for a plain Error instance', () => {
    const { host, status } = makeHost();
    filter.catch(new Error('Database timed out.'), host);
    expect(status).toHaveBeenCalledWith(500);
  });

  it('returns the generic body { code, message } for a plain Error', () => {
    const { host, json } = makeHost();
    filter.catch(new Error('Some internal failure.'), host);

    expect(json).toHaveBeenCalledOnce();
    expect(json.mock.calls[0][0]).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    });
  });

  it('returns HTTP 500 for a non-Error thrown value (string)', () => {
    const { host, status } = makeHost();
    filter.catch('something went wrong', host);
    expect(status).toHaveBeenCalledWith(500);
  });

  it('returns the generic body for a non-Error thrown value', () => {
    const { host, json } = makeHost();
    filter.catch({ weird: 'object' }, host);

    expect(json).toHaveBeenCalledOnce();
    expect(json.mock.calls[0][0]).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    });
  });

  it('does NOT leak the original error message in the response body', () => {
    const { host, json } = makeHost();
    filter.catch(new Error('SECRET: db password is hunter2'), host);

    const body = json.mock.calls[0][0] as { message: string };
    expect(body.message).toBe('Internal server error');
    expect(body.message).not.toContain('hunter2');
  });

  it('passes through HttpException status and body (e.g. 403 from ActiveUserGuard)', () => {
    const { host, status, json } = makeHost();
    const body = { statusCode: 403, message: 'Forbidden' };
    filter.catch(new HttpException(body, 403), host);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(body);
  });

  it('does not call logger.error for HttpException (expected guard rejections are not unknown errors)', () => {
    const { host } = makeHost();
    filter.catch(
      new HttpException({ statusCode: 404, message: 'Not Found' }, 404),
      host,
    );
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it('calls logger.error with { message } and "Unhandled exception"', () => {
    const { host } = makeHost();
    filter.catch(new Error('Database timed out.'), host);
    expect(mockLogger.error).toHaveBeenCalledWith(
      { message: 'Database timed out.' },
      'Unhandled exception',
    );
  });
});
