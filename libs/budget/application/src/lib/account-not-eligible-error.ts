import { DomainError, DomainErrorKind } from 'shared-errors';

/**
 * Raised when a transaction references an `accountId` that does not exist
 * in the caller's workspace. Distinct from `ServiceValidationError` (a
 * well-formed-but-ineligible account is a *business rule* rejection, not an
 * input-shape failure) — callers can `instanceof AccountNotEligibleError` to
 * distinguish this specific cross-aggregate rule from any other
 * `DomainError.unprocessable()` use. Maps to HTTP 422 via the inherited
 * `DomainErrorKind.UNPROCESSABLE`.
 */
export class AccountNotEligibleError extends DomainError {
  public constructor(accountId: string) {
    super(
      DomainErrorKind.UNPROCESSABLE,
      `Account "${accountId}" does not exist in this workspace.`,
    );
  }
}
