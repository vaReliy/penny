import type { WorkspaceMemberRoleType } from 'workspace-core';

/**
 * The caller's membership in the `:workspaceId` path workspace, attached to
 * the request by `WorkspaceMemberGuard` after a fresh DB read.
 */
export interface RequestWorkspaceMembership {
  readonly workspaceId: string;
  readonly role: WorkspaceMemberRoleType;
}
