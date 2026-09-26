import type { CallerIdentity, ServiceContext } from 'shared-kernel';
import type { BudgetServiceConfig } from 'budget-application';
import type { SessionUser } from 'shared-contracts';

import type { RequestWorkspaceMembership } from '../workspace/workspace-membership.js';

/** Currency every budget document is denominated in for the MVP single-currency assumption. */
const DEFAULT_CURRENCY = 'UAH';

/** Builds the `CallerIdentity` a `ServiceContext` needs from the authenticated session user. */
function toCallerIdentity(user: SessionUser): CallerIdentity {
  return { userId: user.id, status: user.status, roles: user.roles };
}

/**
 * Builds the `ServiceContext<BudgetServiceConfig>` every budget controller
 * hands to a `budget-application` service. `workspaceId` comes only from the
 * membership `WorkspaceMemberGuard` verified for the `:workspaceId` path
 * segment — never from the body, query or session. The member role is
 * deliberately not forwarded: budget services stay unaware of workspace
 * roles.
 */
export function buildBudgetContext(
  user: SessionUser,
  membership: RequestWorkspaceMembership,
): ServiceContext<BudgetServiceConfig> {
  return {
    config: {
      workspaceId: membership.workspaceId,
      defaultCurrency: DEFAULT_CURRENCY,
    },
    caller: toCallerIdentity(user),
  };
}
