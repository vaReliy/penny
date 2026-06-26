import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@nestjs/common', () => ({
  Catch: () => () => undefined,
  Logger: class {
    warn = vi.fn();
    error = vi.fn();
  },
}));

import type { ArgumentsHost } from '@nestjs/common';
import { ValidationError } from 'shared-errors';

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

  beforeEach(() => {
    filter = new UnknownErrorFilter();
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

  it('skips handling when the exception is a BaseError instance', () => {
    const { host, status, json } = makeHost();
    filter.catch(new ValidationError('Bad input.'), host);

    // BaseErrorFilter is responsible for BaseError — this filter must bail out
    expect(status).not.toHaveBeenCalled();
    expect(json).not.toHaveBeenCalled();
  });
});
