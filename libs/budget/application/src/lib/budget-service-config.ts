import type { CurrencyCode } from 'shared-util';

/**
 * `ServiceContext.config` shape shared by every budget `application`
 * service. This is the **single centralized point** through which the
 * caller's workspace (and the MVP-wide single-currency assumption) reaches
 * `application` code — every service reads `context.config.workspaceId`
 * (and, where money is constructed, `context.config.defaultCurrency`)
 * instead of taking a workspace from its own params.
 *
 * The interface layer (HTTP controller/CLI command) constructs this config
 * once per request. In `apps/api`, `workspaceId` is taken only from the
 * `:workspaceId` route segment after the caller's membership has been
 * verified, and `defaultCurrency` is `'UAH'`.
 */
export interface BudgetServiceConfig {
  /** The workspace every budget document in this call is scoped to. */
  readonly workspaceId: string;
  /** Currency used to construct `Money` values with no other currency source. */
  readonly defaultCurrency: CurrencyCode;
}
