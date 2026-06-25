import LIVR from 'livr';
import { AuthenticationError } from 'shared-errors';
import { describe, expect, it, vi } from 'vitest';

import { BaseService } from './base-service.js';
import { registerLivrRules } from './livr-rules.js';
import { ServiceValidationError } from './service-validation-error.js';
import type { ServiceContext } from './service-context.js';

interface GreetParams {
  readonly name: string;
}

interface GreetResult {
  readonly message: string;
}

/** Minimal `BaseService` used to exercise the validate→authorize→execute pipeline. */
class GreetService extends BaseService<GreetParams, GreetResult> {
  public constructor(private readonly requireAuth = false) {
    super();
  }

  protected override getValidationSchema(): Record<string, unknown> {
    return {
      name: ['required', 'string', { max_length: 50 }],
    };
  }

  protected override authorize(context: ServiceContext): void {
    if (this.requireAuth && context.caller === null) {
      throw new AuthenticationError();
    }
  }

  protected override execute(params: GreetParams): GreetResult {
    return { message: `Hello, ${params.name}!` };
  }
}

const ANONYMOUS_CONTEXT: ServiceContext = {
  config: {},
  caller: null,
};

const AUTHENTICATED_CONTEXT: ServiceContext = {
  config: {},
  caller: { userId: 'user-1', status: 'active', roles: ['member'] },
};

/** `execute()` throws a plain Error, not a platform `BaseError`. */
class ThrowingExecuteService extends BaseService<GreetParams, GreetResult> {
  protected override getValidationSchema(): Record<string, unknown> {
    return {
      name: ['required', 'string'],
    };
  }

  protected override execute(): GreetResult {
    throw new Error('unexpected database failure');
  }
}

/** `getValidationSchema()` declares no fields at all — fully permissive. */
class EmptySchemaService extends BaseService<
  Record<string, unknown>,
  Record<string, unknown>
> {
  protected override getValidationSchema(): Record<string, unknown> {
    return {};
  }

  protected override execute(
    params: Record<string, unknown>,
  ): Record<string, unknown> {
    return params;
  }
}

describe('BaseService pipeline', () => {
  it('throws ServiceValidationError when params fail the LIVR schema', async () => {
    const service = new GreetService();

    await expect(
      service.run({ name: '' }, ANONYMOUS_CONTEXT),
    ).rejects.toBeInstanceOf(ServiceValidationError);
  });

  it('exposes the LIVR field errors on the thrown ServiceValidationError', async () => {
    const service = new GreetService();

    let caughtError: unknown;
    try {
      await service.run({ name: '' }, ANONYMOUS_CONTEXT);
    } catch (caught) {
      caughtError = caught;
    }

    expect(caughtError).toBeInstanceOf(ServiceValidationError);
    const error = caughtError as ServiceValidationError;
    expect(error.fields).toHaveProperty('name');
    expect(error.serialize()).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'The request payload is invalid.',
      statusCode: 400,
    });
  });

  it('throws AuthenticationError when authorize rejects an anonymous caller', async () => {
    const service = new GreetService(true);

    await expect(
      service.run({ name: 'Ada' }, ANONYMOUS_CONTEXT),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('returns { data } on the happy path', async () => {
    const service = new GreetService(true);

    const outcome = await service.run({ name: 'Ada' }, AUTHENTICATED_CONTEXT);

    expect(outcome).toEqual({ data: { message: 'Hello, Ada!' } });
  });

  it('does not include `fields` in serialize()/toJSON() output', async () => {
    const service = new GreetService();

    let caughtError: unknown;
    try {
      await service.run({ name: '' }, ANONYMOUS_CONTEXT);
    } catch (caught) {
      caughtError = caught;
    }

    const error = caughtError as ServiceValidationError;
    expect(Object.keys(error.serialize())).not.toContain('fields');
    expect(Object.keys(error.toJSON())).not.toContain('fields');
    expect(JSON.stringify(error)).not.toContain('fields');
  });

  it('propagates an unexpected non-BaseError thrown by execute() unchanged', async () => {
    const service = new ThrowingExecuteService();

    await expect(
      service.run({ name: 'Ada' }, ANONYMOUS_CONTEXT),
    ).rejects.toThrowError('unexpected database failure');

    let caughtError: unknown;
    try {
      await service.run({ name: 'Ada' }, ANONYMOUS_CONTEXT);
    } catch (caught) {
      caughtError = caught;
    }

    // BaseService must not wrap, swallow, or reclassify unexpected errors —
    // callers further up the stack rely on seeing the original error type.
    expect(caughtError).toBeInstanceOf(Error);
    expect(caughtError).not.toBeInstanceOf(ServiceValidationError);
  });

  it('strips fields not declared in an empty/permissive validation schema', async () => {
    const service = new EmptySchemaService();

    const outcome = await service.run(
      { name: 'Ada', extra: 'should be dropped' },
      ANONYMOUS_CONTEXT,
    );

    // LIVR only passes through fields explicitly declared in the schema, so
    // a service that forgets to declare a field silently drops it instead of
    // failing loudly. Pinning this behavior so a future LIVR upgrade or
    // schema change doesn't silently start leaking undeclared input.
    expect(outcome).toEqual({ data: {} });
  });

  it('registers LIVR default rules at most once, even across repeated calls', () => {
    // `BaseService` no longer calls `registerLivrRules()` itself — the
    // interface layer (API/CLI/queue worker bootstrap) is responsible for
    // calling it once at process startup. Call it explicitly here to
    // exercise the module-level idempotency guard in livr-rules.ts.
    registerLivrRules();

    const registerSpy = vi.spyOn(LIVR.Validator, 'registerDefaultRules');

    // The module-level guard is already tripped by the call above (and by
    // any earlier calls in this process), so every call here is a
    // "repeated" call — proving the guard holds across the module's
    // lifetime, not just within a single test.
    registerLivrRules();
    registerLivrRules();
    registerLivrRules();

    expect(registerSpy).not.toHaveBeenCalled();

    registerSpy.mockRestore();
  });
});
