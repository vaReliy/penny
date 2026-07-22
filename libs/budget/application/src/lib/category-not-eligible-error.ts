import { DomainError, DomainErrorKind } from 'shared-errors';

/**
 * Raised when a transaction references a `categoryId` that does not exist
 * in the caller's workspace, or that exists but is archived. Distinct from
 * `ServiceValidationError` (a well-formed-but-ineligible category is a
 * *business rule* rejection, not an input-shape failure) — callers can
 * `instanceof CategoryNotEligibleError` to distinguish this specific
 * cross-aggregate rule from any other `DomainError.unprocessable()` use.
 * Maps to HTTP 422 via the inherited `DomainErrorKind.UNPROCESSABLE`.
 */
export class CategoryNotEligibleError extends DomainError {
  public constructor(categoryId: string) {
    super(
      DomainErrorKind.UNPROCESSABLE,
      `Category "${categoryId}" does not exist in this workspace, or is archived.`,
    );
  }
}
