import { AuthenticationError } from 'shared-errors';
import { UserStatus } from 'shared-contracts';
import type { ServiceContext } from 'shared-kernel';

import type { BudgetServiceConfig } from './budget-service-config.js';

/** Message used when a non-`active` (or anonymous) caller invokes a budget service. */
const NOT_ACTIVE_MESSAGE =
  'Only an active user of the workspace may perform this action.';

/**
 * Shared `authorize` check for every budget `application` service: the
 * caller must be an `active` user. MVP has exactly one implicit workspace
 * (see `BudgetServiceConfig`), so "active user of the workspace" reduces to
 * "active user" — the additive seam for real workspace-membership
 * authorization is `context.caller`/`context.config`, not new domain code
 * (per the budget domain model ADR).
 *
 * @throws {AuthenticationError} If there is no caller, or the caller's
 * status is not `active`.
 */
export function assertActiveCaller(
  context: ServiceContext<BudgetServiceConfig>,
): void {
  if (context.caller?.status !== UserStatus.ACTIVE) {
    throw new AuthenticationError(NOT_ACTIVE_MESSAGE);
  }
}
