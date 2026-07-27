import { DEFAULT_WORKSPACE_ID } from 'budget-contracts';
import type { CallerIdentity, ServiceContext } from 'shared-kernel';
import type { BudgetServiceConfig } from 'budget-application';
import type { SessionUser } from 'shared-contracts';

/** Currency every budget document is denominated in for the MVP single-currency assumption. */
const DEFAULT_CURRENCY = 'UAH';

/** Builds the `CallerIdentity` a `ServiceContext` needs from the authenticated session user. */
function toCallerIdentity(user: SessionUser): CallerIdentity {
  return { userId: user.id, status: user.status, roles: user.roles };
}

/**
 * Builds the `ServiceContext<BudgetServiceConfig>` every budget controller
 * hands to a `budget-application` service. `workspaceId` is stamped with the
 * single-implicit-workspace placeholder here — the ADR-mandated single point
 * where `DEFAULT_WORKSPACE_ID` reaches the API boundary (`application` code
 * never imports it directly).
 */
export function buildBudgetContext(
  user: SessionUser,
): ServiceContext<BudgetServiceConfig> {
  return {
    config: {
      workspaceId: DEFAULT_WORKSPACE_ID,
      defaultCurrency: DEFAULT_CURRENCY,
    },
    caller: toCallerIdentity(user),
  };
}
