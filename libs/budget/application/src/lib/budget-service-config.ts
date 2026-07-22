import type { CurrencyCode } from 'shared-util';

/**
 * `ServiceContext.config` shape shared by every budget `application`
 * service. This is the **single centralized point** through which the
 * implicit single-workspace/single-currency MVP assumption reaches
 * `application` code — every service reads `context.config.workspaceId`
 * (and, where money is constructed, `context.config.defaultCurrency`)
 * instead of any service importing a literal or a `budget-contracts`
 * constant directly.
 *
 * Per the budget domain model ADR, `budget-contracts`' `DEFAULT_WORKSPACE_ID`
 * is applied **only at the API/CLI boundary** — `application` code never
 * imports it. The interface layer (HTTP controller/CLI command, built in a
 * later task) is responsible for constructing this config once per request,
 * stamping `workspaceId: DEFAULT_WORKSPACE_ID` (swapped for a real
 * caller-derived workspace id once workspace-scoped multitenancy ships) and
 * `defaultCurrency: 'UAH'` (the MVP-wide single-currency assumption).
 */
export interface BudgetServiceConfig {
  /** The workspace every budget document in this call is scoped to. */
  readonly workspaceId: string;
  /** Currency used to construct `Money` values with no other currency source. */
  readonly defaultCurrency: CurrencyCode;
}
