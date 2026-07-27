import type { IAccountRepository, Account } from 'budget-core';
import type { CurrencyCode } from 'shared-util';

/**
 * Display name for the single account seeded per workspace at MVP. Per
 * `DECISIONS.md` ADR-007 §4 ("Transaction requires accountId"), a
 * transaction's `accountId` is "[d]efaulted to the seeded account at the
 * API/CLI boundary, never in the core aggregate" — no prior task built the
 * boundary-side resolution this implies, since `GET /api/budget/balance`
 * (this task) is the first caller that needs an `accountId` without one
 * being supplied by the request itself.
 */
const DEFAULT_ACCOUNT_NAME = 'Main';

/**
 * Resolves the single MVP-seeded `Account` for `workspaceId`, creating it on
 * first use. Delegates the actual find-or-create to
 * `IAccountRepository.findOrCreateDefault`, an atomic upsert — this function
 * itself does no read-then-write, so it introduces no additional race beyond
 * the repository's own.
 */
export async function resolveDefaultAccount(
  accountRepository: IAccountRepository,
  workspaceId: string,
  defaultCurrency: CurrencyCode,
): Promise<Account> {
  return accountRepository.findOrCreateDefault(
    workspaceId,
    DEFAULT_ACCOUNT_NAME,
    defaultCurrency,
  );
}
