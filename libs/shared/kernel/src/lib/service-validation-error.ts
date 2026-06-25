import { ValidationError } from 'shared-errors';

/** Default user-facing message when LIVR validation fails. */
const DEFAULT_MESSAGE = 'The request payload is invalid.';

/**
 * Raised by `BaseService` when the LIVR schema rejects the input params.
 *
 * Extends the platform `ValidationError` so it still serializes to the
 * sanitized `{ code, message, statusCode }` shape over the wire, while
 * additionally exposing the raw LIVR field errors (`fields`) for in-process
 * consumers — e.g. HTTP middleware that maps field errors onto a 422
 * response body per `rules/validation-authorization.md`. `fields` is never
 * part of `serialize()`/`toJSON()`, so it cannot leak to clients by accident.
 */
export class ServiceValidationError extends ValidationError {
  /** Raw `{ field: errorCode }` map returned by `LIVR.Validator#getErrors`. */
  public readonly fields: Readonly<Record<string, unknown>>;

  public constructor(
    fields: Readonly<Record<string, unknown>>,
    message: string = DEFAULT_MESSAGE,
  ) {
    super(message);
    this.fields = fields;
  }
}
