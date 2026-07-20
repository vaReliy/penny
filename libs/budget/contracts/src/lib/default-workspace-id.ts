/**
 * Placeholder workspace identity stamped onto inbound budget requests at the
 * API/CLI boundary only — core/application code never imports this. Exists
 * because the budget domain is workspace-scoped end-to-end (per ADR-007)
 * while the Workspace feature itself is parked; today there is exactly one
 * implicit workspace.
 *
 * TODO: remove this constant once workspace-scoped multitenancy ships and
 * `workspaceId` is derived from the authenticated caller's membership.
 */
export const DEFAULT_WORKSPACE_ID = 'default-workspace';
