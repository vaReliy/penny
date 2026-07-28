import LIVR from 'livr';

import { ServiceValidationError } from './service-validation-error.js';
import type { ServiceContext } from './service-context.js';

/**
 * Wrapper around a successful `BaseService.run` call. Kept as an object
 * (rather than returning `Result` directly) so the envelope can gain
 * metadata (e.g. pagination, warnings) later without breaking callers.
 */
export interface ServiceOutcome<TResult> {
  readonly data: TResult;
}

/**
 * Base class for every application service in the platform.
 *
 * Implements the fixed pipeline: validate → authorize → execute.
 *
 * 1. `validate` — parses `params` against `getValidationSchema()` using
 *    LIVR. Throws `ServiceValidationError` (a `ValidationError` subclass)
 *    on failure.
 * 2. `authorize` — overridable hook checked against `ServiceContext`.
 *    Defaults to allow-all; subclasses needing access control override it
 *    and throw an `AuthenticationError` or `DomainError` (from
 *    `shared-errors`) to reject the call.
 * 3. `execute` — abstract; subclasses implement the actual business logic
 *    using the *validated* params.
 *
 * Framework-free by design: no DI decorators, no HTTP/queue concerns. The
 * concrete `ServiceContext` is built by the interface layer (API/CLI/queue
 * worker) and handed in — this class never reads `process.env` or any
 * transport object directly.
 *
 * Does not register LIVR's custom rules itself — the interface layer
 * (API/CLI/queue worker bootstrap) must call `registerLivrRules()` once at
 * process startup, before constructing the first `LIVR.Validator`. See
 * `livr-rules.ts`.
 *
 * @template TParams - Raw input shape accepted by `run`, before validation.
 * @template TResult - Shape of `data` in the returned `ServiceOutcome`.
 */
export abstract class BaseService<TParams, TResult> {
  /**
   * Runs the validate → authorize → execute pipeline.
   *
   * @param params - Raw, unvalidated input.
   * @param context - Caller identity and config for this invocation.
   * @throws {ServiceValidationError} If `params` fails the LIVR schema.
   * @throws {BaseError} Any error thrown by `authorize` or `execute`.
   */
  public async run(
    params: TParams,
    context: ServiceContext,
  ): Promise<ServiceOutcome<TResult>> {
    const validParams = this.validate(params);
    await this.authorize(context, validParams);
    const data = await this.execute(validParams, context);

    return { data };
  }

  /**
   * LIVR schema describing the shape of `TParams`. Subclasses must supply
   * one — see https://github.com/koorchik/js-validator-livr for rule syntax.
   */
  protected abstract getValidationSchema(): Record<string, unknown>;

  /**
   * Authorization hook, called after validation and before `execute`.
   * Default implementation allows every call — override to enforce
   * role/ownership checks against `context.caller`, throwing
   * `AuthenticationError` (no/invalid caller) or `DomainError.forbidden()`
   * (caller not permitted) from `shared-errors` to reject the call.
   */
  protected authorize(
    context: ServiceContext,
    params: TParams,
  ): void | Promise<void> {
    // Allow-all by default; subclasses opt into stricter checks. Referencing
    // both parameters keeps their names in the signature (useful for
    // overriders and generated docs) without tripping no-unused-vars.
    void context;
    void params;
  }

  /** Business logic. Receives validated params and the service context. */
  protected abstract execute(
    params: TParams,
    context: ServiceContext,
  ): Promise<TResult> | TResult;

  /**
   * Validates `params` against `getValidationSchema()`.
   *
   * @throws {ServiceValidationError} If validation fails.
   */
  private validate(params: TParams): TParams {
    const validator = new LIVR.Validator<TParams>(this.getValidationSchema());
    const validParams = validator.validate(params);

    // LIVR signals a rejected schema with `false`, but a non-plain-object
    // input (its `isObject` is `obj?.constructor === Object`, so a
    // null-prototype object fails it) makes `validate` return `undefined`
    // instead — checking only for `false` lets that through and hands
    // `undefined` to `authorize`/`execute`.
    if (!validParams) {
      const errors = validator.getErrors();
      throw new ServiceValidationError(
        typeof errors === 'string' ? { params: errors } : (errors ?? {}),
      );
    }

    return validParams;
  }
}
