import { describe, expect, it } from 'vitest';

import { AuthenticationError } from './authentication-error.js';
import { DomainError } from './domain-error.js';
import { InfrastructureError } from './infrastructure-error.js';
import { NotFoundError } from './not-found-error.js';
import { ValidationError } from './validation-error.js';

describe('BaseError hierarchy', () => {
  it('serializes ValidationError without leaking the stack trace', () => {
    const error = new ValidationError('Email is required.');

    expect(error.serialize()).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Email is required.',
      statusCode: 400,
    });
    expect(JSON.stringify(error)).not.toContain('stack');
  });

  it('maps AuthenticationError to 401', () => {
    expect(new AuthenticationError().statusCode).toBe(401);
  });

  it('maps NotFoundError to 404', () => {
    expect(new NotFoundError().statusCode).toBe(404);
  });

  it('maps InfrastructureError to 500 with a generic message', () => {
    const error = new InfrastructureError();
    expect(error.statusCode).toBe(500);
    expect(error.message).not.toMatch(/stack|internal/i);
  });

  it('maps each DomainError kind to its HTTP status and code', () => {
    expect(DomainError.conflict().statusCode).toBe(409);
    expect(DomainError.conflict().code).toBe('DOMAIN_CONFLICT_ERROR');
    expect(DomainError.forbidden().statusCode).toBe(403);
    expect(DomainError.forbidden().code).toBe('DOMAIN_FORBIDDEN_ERROR');
    expect(DomainError.unprocessable().statusCode).toBe(422);
    expect(DomainError.unprocessable().code).toBe('DOMAIN_UNPROCESSABLE_ERROR');
  });

  it('never includes a stack property in the serialized shape', () => {
    const error = DomainError.conflict('Already exists.');
    const serialized = error.serialize();

    expect(Object.keys(serialized).sort()).toEqual([
      'code',
      'message',
      'statusCode',
    ]);
  });
});
